import { readFile } from 'node:fs/promises'

const raw = await readFile(
  new URL('../knowledge-base/raw/karpathy-autoresearch-raw.md', import.meta.url),
  'utf8',
)

let cognitiveNoteTool
let savedContent

const ctx = {
  tools: {
    register(tool) {
      if (tool.name === 'make_cognitive_note') {
        cognitiveNoteTool = tool
      }
    },
  },
  llm: {
    async *stream() {
      yield {
        type: 'text-delta',
        text: [
          '---',
          'type: 认知',
          'tags: [自动循环, Karpathy]',
          '---',
          '',
          '# Karpathy autoresearch：用方法论驱动自动循环',
          '',
          '来源：[[karpathy-autoresearch-raw]]',
          '',
          '## 摘要',
          '',
          '用方法论驱动 agent 自动循环。',
          '',
          '## 关键点',
          '',
          '- program.md 是方法论。',
          '- 人管方向，agent 管代码。',
        ].join('\n'),
      }
      yield { type: 'finish', reason: { kind: 'ok' } }
    },
  },
  fs: {
    async resolve(path) {
      return { displayPath: path }
    },
    async writeText(_target, content) {
      savedContent = content
      return {
        operation: 'create',
        version: 'mock-version',
        before: null,
        after: content,
      }
    },
  },
}

const plugin = await import('../lib/index.js')

plugin.apply(ctx, {
  greeting: 'Hello',
  provider: 'deepseek-official',
  model: 'deepseek-v4-flash',
})

const output = await cognitiveNoteTool.execute(
  {
    rawText: raw,
    sourceTitle: 'lecture-13-loop-engineering',
    title: 'Karpathy autoresearch：用方法论驱动自动循环',
    outputPath: 'knowledge-base/wiki/Karpathy-autoresearch-用方法论驱动自动循环.md',
  },
  { signal: new AbortController().signal },
)

console.log('--- make_cognitive_note output ---')
console.log(output)
if (!output.includes('已保存：')) {
  throw new Error('expected save confirmation in tool output')
}
if (!savedContent?.includes('# Karpathy autoresearch')) {
  throw new Error('expected note content to be written through ctx.fs')
}
console.log('--- self-check passed ---')
