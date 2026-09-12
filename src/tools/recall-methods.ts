import '@deepseek-ai/dsh-tools'
import '@deepseek-ai/dsh-fs'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import type { Config } from '../config.js'
import { parseFrontmatter, parseList, stripFrontmatter } from '../lib/frontmatter.js'
import { rankMethodNotesByLlm } from '../lib/recall-llm.js'

interface MethodIndexEntry {
  name: string
  file: string
  description: string
  whenToUse: string
  tags: string[]
  role?: string
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0)
}

function scoreEntry(entry: MethodIndexEntry, query: string): number {
  const searchText = [
    entry.name,
    entry.description,
    entry.whenToUse,
    entry.tags.join(' '),
  ].join(' ')
  const queryTokens = new Set(tokenize(query))
  const searchTokens = new Set(tokenize(searchText))
  let score = 0

  for (const token of queryTokens) {
    if (searchText.includes(token)) score += 2
    if (searchTokens.has(token)) score += 1
  }

  return score
}

function formatNote(text: string, path: string): string {
  const frontmatter = parseFrontmatter(text)
  const body = stripFrontmatter(text)
  const title = body.split('\n').find((line) => line.startsWith('# '))?.slice(2)

  return [
    `### ${title ?? frontmatter.name ?? path}`,
    `- 名称：${frontmatter.name ?? path}`,
    `- 触发条件：${frontmatter.whenToUse ?? frontmatter.description ?? ''}`,
    `- 标签：${parseList(frontmatter.tags).join(', ')}`,
    `- 路径：${path}`,
    '',
    body,
  ].join('\n')
}

export function registerRecallMethodsTool(ctx: Context, config: Config) {
  ctx.tools.register(
    defineTool({
      name: 'recall_methods',
      description: '从方法论召回库中，按场景召回最相关的 1-3 条可复用方法。',
      parameters: {
        query: {
          type: 'string',
          required: true,
          description: '当前问题或场景描述',
        },
        role: {
          type: 'string',
          description: '可选角色/技能包过滤',
        },
        maxRecall: {
          type: 'integer',
          description: '最多召回几条，默认 3',
        },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute(args, exec) {
        const cwd = exec.agent?.session.header.cwd ?? '.'
        const root = await ctx.fs.resolve(config.methodsRoot, { cwd, signal: exec.signal })
        const indexPath = `${config.methodsRoot}/index.json`
        let entries: MethodIndexEntry[] = []

        try {
          const indexTarget = await ctx.fs.resolve(indexPath, { cwd, signal: exec.signal })
          const indexInfo = await ctx.fs.stat(indexTarget, exec.signal)
          if (indexInfo?.type === 'file') {
            const indexText = await ctx.fs.readText(indexTarget, exec.signal)
            entries = JSON.parse(indexText) as MethodIndexEntry[]
          }
        } catch {
          // Fall through to directory scan when the index has not been built yet.
        }

        if (entries.length === 0) {
          const list = await ctx.fs.listDir(root, exec.signal)
          for (const item of list) {
            if (item.type !== 'file' || !item.name.endsWith('.md')) continue
            const text = await ctx.fs.readText(item.target, exec.signal)
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

        const filtered = entries.filter((entry) => !args.role || entry.role === args.role)
        const limit = Math.max(1, args.maxRecall ?? config.maxRecall)
        let selected: MethodIndexEntry[]

        try {
          const candidates = filtered.map((entry) => ({
            id: entry.name,
            name: entry.name,
            description: entry.description,
            whenToUse: entry.whenToUse,
            tags: entry.tags,
            role: entry.role,
          }))
          const ranked = await rankMethodNotesByLlm(
            ctx,
            config,
            args.query,
            candidates,
            exec.signal,
          )
          selected = ranked
            .slice(0, limit)
            .map((item) => filtered.find((entry) => entry.name === item.candidate.id))
            .filter((entry): entry is MethodIndexEntry => Boolean(entry))
        } catch {
          selected = filtered
            .map((entry) => ({ entry, score: scoreEntry(entry, args.query) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map((item) => item.entry)
        }

        if (selected.length === 0) {
          return '没有召回任何方法笔记。'
        }

        const results: string[] = []
        for (const entry of selected) {
          const filePath = `${config.methodsRoot}/${entry.file}`
          const target = await ctx.fs.resolve(filePath, { cwd, signal: exec.signal })
          const text = await ctx.fs.readText(target, exec.signal)
          results.push(formatNote(text, entry.file))
        }

        return results.join('\n\n---\n\n')
      },
    }),
  )
  console.log('[dsh-knowledge-transform] tool registered: recall_methods')
}
