import '@deepseek-ai/dsh-llm'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Context } from '@deepseek-ai/cordis'
import type { Config } from '../config.js'

export interface MethodCandidate {
  id: string
  name: string
  description?: string
  whenToUse?: string
  tags?: string[]
  role?: string
}

export interface RankedCandidate<T extends MethodCandidate = MethodCandidate> {
  candidate: T
  rank: number
  score?: number
  reason?: string
}

interface RankItem {
  id: string
  rank: number
  score?: number
  reason?: string
}

function buildPrompt(query: string, candidates: readonly MethodCandidate[]): string {
  const lines = candidates.map((candidate, index) => {
    const detail = [
      candidate.description && `说明：${candidate.description}`,
      candidate.whenToUse && `触发条件：${candidate.whenToUse}`,
      candidate.tags?.length ? `标签：${candidate.tags.join(', ')}` : '',
    ].filter(Boolean).join('\n')
    return `${index + 1}. id: ${candidate.id}\n名称：${candidate.name}\n${detail}`
  }).join('\n\n')

  return [
    '你是方法论召回排序器。请根据“当前问题/场景”，把候选方法笔记按相关度从高到低排序。',
    '只输出一个 JSON 对象，不要输出 Markdown 代码块或解释。',
    '输出格式必须严格如下：',
    '{',
    '  "ranked": [',
    '    {"id":"候选id","rank":1,"score":0.95,"reason":"为什么匹配当前场景"}',
    '  ]',
    '}',
    '要求：ranked 必须覆盖所有候选 id；rank 从 1 连续递增；score 在 0 到 1；reason 用一句中文说明。',
    '',
    '当前问题/场景：',
    query,
    '',
    '候选方法笔记：',
    lines,
  ].join('\n')
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('LLM did not return a JSON object')
  }
  return JSON.parse(cleaned.slice(start, end + 1))
}

function parseRankItems(text: string): RankItem[] {
  const value = extractJson(text)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('LLM ranking result must be a JSON object')
  }
  const ranked = (value as Record<string, unknown>).ranked
  if (!Array.isArray(ranked) || ranked.length === 0) {
    throw new Error('LLM ranking result must contain a non-empty ranked array')
  }
  return ranked.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`ranked[${index}] must be an object`)
    }
    const record = item as Record<string, unknown>
    if (typeof record.id !== 'string' || typeof record.rank !== 'number') {
      throw new Error(`ranked[${index}] requires string id and number rank`)
    }
    return {
      id: record.id,
      rank: record.rank,
      score: typeof record.score === 'number' ? record.score : undefined,
      reason: typeof record.reason === 'string' ? record.reason : undefined,
    }
  })
}

function reorder<T extends MethodCandidate>(
  candidates: readonly T[],
  items: RankItem[],
): RankedCandidate<T>[] {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]))
  const used = new Set<string>()
  const result: RankedCandidate<T>[] = []

  for (const item of [...items].sort((a, b) => a.rank - b.rank)) {
    const candidate = byId.get(item.id)
    if (!candidate || used.has(item.id)) continue
    used.add(item.id)
    result.push({
      candidate,
      rank: result.length + 1,
      score: item.score,
      reason: item.reason,
    })
  }

  for (const candidate of candidates) {
    if (!used.has(candidate.id)) {
      result.push({ candidate, rank: result.length + 1 })
    }
  }

  return result
}

export async function rankMethodNotesByLlm<T extends MethodCandidate>(
  ctx: Context,
  config: Config,
  query: string,
  candidates: readonly T[],
  signal: AbortSignal,
): Promise<RankedCandidate<T>[]> {
  if (candidates.length === 0) return []

  const prompt = buildPrompt(query, candidates)
  let text = ''
  let finish: { kind: string; failure?: { message?: string; code?: string } } | undefined

  for await (const chunk of ctx.llm.stream({
    provider: config.provider,
    model: config.model,
    system: '你是严谨的方法论召回排序器。',
    messages: [
      createUserMessage({
        source: { kind: 'user' },
        content: [{ type: 'text', text: prompt }],
      }),
    ],
    signal,
  })) {
    if (chunk.type === 'text-delta') {
      text += chunk.text
    } else if (chunk.type === 'finish') {
      finish = chunk.reason as typeof finish
    }
  }

  if (finish?.kind === 'aborted') {
    throw new Error(finish.failure?.message ?? 'LLM ranking was aborted')
  }
  if (finish?.kind === 'error') {
    throw new Error(finish.failure?.message ?? 'LLM ranking failed')
  }
  if (finish?.kind !== 'stop') {
    throw new Error(`LLM ranking ended with ${finish?.kind ?? 'no finish chunk'}`)
  }

  return reorder(candidates, parseRankItems(text))
}
