import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import '@deepseek-ai/dsh-llm'
import '@deepseek-ai/dsh-fs'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Config } from '../config.js'
import { parseFrontmatter, parseList, stripFrontmatter } from '../lib/frontmatter.js'
import { rankMethodNotesByLlm } from '../lib/recall-llm.js'

interface MethodEntry {
  name: string
  file: string
  description: string
  whenToUse: string
  tags: string[]
  role?: string
}

function messageText(messages: any[]): string {
  return messages
    .flatMap((message) => message.content ?? [])
    .map((block) => block.text ?? '')
    .join('\n')
    .slice(0, 4000)
}

function formatInjectedNote(text: string, fileName: string): string {
  const frontmatter = parseFrontmatter(text)
  const body = stripFrontmatter(text)
  const title = body.split('\n').find((line) => line.startsWith('# '))?.slice(2)
  return [
    `<method_note name="${frontmatter.name ?? fileName}">`,
    `标题：${title ?? frontmatter.name ?? fileName}`,
    `触发条件：${frontmatter.whenToUse ?? frontmatter.description ?? ''}`,
    '',
    body,
    '</method_note>',
  ].join('\n')
}

export function registerMethodInjection(ctx: Context, config: Config) {
  if (typeof ctx.on !== 'function') return
  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (decision.kind !== 'enter') return decision

    try {
      const cwd = payload.agent?.session.header.cwd ?? '.'
      const root = await ctx.fs.resolve(config.methodsRoot, { cwd, signal: payload.signal })
      const indexPath = `${config.methodsRoot}/index.json`
      let entries: MethodEntry[] = []

      try {
        const indexTarget = await ctx.fs.resolve(indexPath, { cwd, signal: payload.signal })
        const indexInfo = await ctx.fs.stat(indexTarget, payload.signal)
        if (indexInfo?.type === 'file') {
          const indexText = await ctx.fs.readText(indexTarget, payload.signal)
          entries = JSON.parse(indexText) as MethodEntry[]
        }
      } catch {
        const list = await ctx.fs.listDir(root, payload.signal)
        for (const item of list) {
          if (item.type !== 'file' || !item.name.endsWith('.md')) continue
          const text = await ctx.fs.readText(item.target, payload.signal)
          const frontmatter = parseFrontmatter(text)
          entries.push({
            name: frontmatter.name ?? item.name.replace(/\.md$/, ''),
            file: item.name,
            description: frontmatter.description ?? '',
            whenToUse: frontmatter.whenToUse ?? '',
            tags: parseList(frontmatter.tags),
            role: frontmatter.role,
          })
        }
      }

      if (entries.length === 0) return decision

      const query = messageText(payload.messages)
      const candidates = entries.map((entry) => ({
        id: entry.name,
        name: entry.name,
        description: entry.description,
        whenToUse: entry.whenToUse,
        tags: entry.tags,
        role: entry.role,
      }))

      let ranked
      try {
        ranked = await rankMethodNotesByLlm(ctx, config, query, candidates, payload.signal)
      } catch {
        ranked = candidates.map((candidate, index) => ({ candidate, rank: index + 1 }))
      }

      const selected = ranked.slice(0, Math.max(1, config.maxRecall))
      const sections: string[] = []

      for (const item of selected) {
        const entry = entries.find((candidate) => candidate.name === item.candidate.id)
        if (!entry) continue
        const filePath = `${config.methodsRoot}/${entry.file}`
        const target = await ctx.fs.resolve(filePath, { cwd, signal: payload.signal })
        const text = await ctx.fs.readText(target, payload.signal)
        sections.push(formatInjectedNote(text, entry.file))
      }

      if (sections.length === 0) return decision

      const note = createUserMessage({
        content: [
          {
            type: 'text',
            text: [
              '<system-reminder>以下是当前任务可能相关的方法笔记，请先参考，再继续行动。</system-reminder>',
              '',
              ...sections,
            ].join('\n'),
          },
        ],
        source: { kind: 'plugin', plugin: 'dsh-knowledge-transform', form: 'instructions' },
      })

      return {
        ...decision,
        messages: [note, ...decision.messages],
      }
    } catch {
      return decision
    }
  })
}
