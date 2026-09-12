import { readFile } from 'node:fs/promises'

const raw = await readFile(
  new URL('../knowledge-base/raw/karpathy-autoresearch-raw.md', import.meta.url),
  'utf8',
)

let methodNoteTool
let savedContent

const ctx = {
  tools: {
    register(tool) {
      if (tool.name === 'make_method_note') methodNoteTool = tool
    },
  },
  llm: {
    async *stream() {
      yield {
        type: 'text-delta',
        text: [
          '---',
          'type: 方法',
          'name: direction-over-code',
          'description: 当需要让 agent 长期自动执行任务时，把方向和方法论交给它，而不是逐条指挥。',
          'whenToUse: 用户希望 agent 自动持续完成任务，而不是每步都下达指令。',
          'tags: [方法论, 自动循环]',
          'role: reliable-agent',
          '---',
          '',
          '# 人管方向，Agent 管代码',
          '',
          '## 何时使用',
          '',
          '当需要让 agent 自动持续执行任务时。',
          '',
          '## 怎么做',
          '',
          '1. 把研究方法论写进 program.md。',
          '2. 让 agent 只读方法论，自己持续执行。',
          '',
          '## 为什么',
          '',
          '人擅长定方向，agent 擅长持续执行代码。',
          '',
          '## 例子',
          '',
          'Karpathy autoresearch。',
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
  methodsRoot: 'knowledge-base/methods',
  maxRecall: 3,
})

const output = await methodNoteTool.execute(
  {
    sourceText: raw,
    sourceTitle: 'karpathy-autoresearch-raw',
    title: '人管方向，Agent 管代码',
    role: 'reliable-agent',
    outputPath: 'knowledge-base/methods/direction-over-code.md',
  },
  { signal: new AbortController().signal },
)

console.log('--- make_method_note output ---')
console.log(output)

if (!output.includes('type: 方法')) {
  throw new Error('expected a method note')
}
if (!savedContent?.includes('name: direction-over-code')) {
  throw new Error('expected method note to be saved through ctx.fs')
}

console.log('--- method note self-check passed ---')
