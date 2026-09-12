import { readFile, readdir } from 'node:fs/promises'

const methodsRoot = new URL('../knowledge-base/methods/', import.meta.url)
const methodFiles = (await readdir(methodsRoot)).filter((name) => name.endsWith('.md'))
const methodContents = new Map()

for (const name of methodFiles) {
  methodContents.set(name, await readFile(new URL(name, methodsRoot), 'utf8'))
}

const methodIndex = JSON.parse(await readFile(new URL('index.json', methodsRoot), 'utf8'))

function createToolContext(llmStream) {
  const tools = new Map()
  const saved = new Map()

  const ctx = {
    tools: {
      register(tool) {
        tools.set(tool.name, tool)
      },
    },
    llm: {
      stream: llmStream,
    },
    fs: {
      async resolve(path) {
        return { displayPath: path }
      },
      async stat(target) {
        return { type: target.displayPath.endsWith('index.json') ? 'file' : 'file' }
      },
      async listDir() {
        return methodFiles.map((name) => ({ name, type: 'file', target: { displayPath: name } }))
      },
      async readText(target) {
        if (target.displayPath.endsWith('index.json')) return JSON.stringify(methodIndex)
        const key = target.displayPath.split('/').pop() ?? target.displayPath
        return methodContents.get(key) ?? ''
      },
      async writeText(target, content) {
        saved.set(target.displayPath, content)
        return { operation: 'create', version: 'v1', before: null, after: content }
      },
    },
  }

  return { ctx, tools, saved }
}

async function runCase(name, llmStream, call) {
  const { ctx, tools } = createToolContext(llmStream)
  const plugin = await import('../lib/index.js')
  plugin.apply(ctx, {
    greeting: 'Hello',
    provider: 'deepseek-official',
    model: 'deepseek-v4-flash',
    methodsRoot: 'knowledge-base/methods',
    maxRecall: 3,
  })

  try {
    await call(tools, ctx)
    console.log(`[pass] ${name}`)
  } catch (error) {
    if (name.startsWith('expect-fail')) {
      console.log(`[pass] ${name}: ${error.message}`)
    } else {
      throw error
    }
  }
}

const signal = new AbortController().signal

await runCase(
  'expect-fail: empty method note',
  async function* () {
    yield { type: 'finish', reason: { kind: 'stop' } }
  },
  async (tools) => {
    await tools.get('make_method_note').execute(
      { sourceText: 'x', outputPath: 'knowledge-base/methods/bad.md' },
      { signal },
    )
  },
)

await runCase(
  'expect-fail: missing method sections',
  async function* () {
    yield {
      type: 'text-delta',
      text: [
        '---',
        'type: 方法',
        'name: bad',
        'description: bad',
        'whenToUse: bad',
        'tags: [bad]',
        'role: generalist',
        '---',
        '',
        '# bad',
      ].join('\n'),
    }
    yield { type: 'finish', reason: { kind: 'stop' } }
  },
  async (tools) => {
    await tools.get('make_method_note').execute(
      { sourceText: 'x', outputPath: 'knowledge-base/methods/bad.md' },
      { signal },
    )
  },
)

await runCase(
  'valid method note still passes',
  async function* () {
    yield {
      type: 'text-delta',
      text: [
        '---',
        'type: 方法',
        'name: good-method',
        'description: good',
        'whenToUse: good',
        'tags: [good]',
        'role: generalist',
        '---',
        '',
        '# good method',
        '',
        '## 何时使用',
        '',
        '## 怎么做',
        '',
        '## 为什么',
        '',
        '## 例子',
      ].join('\n'),
    }
    yield { type: 'finish', reason: { kind: 'stop' } }
  },
  async (tools) => {
    await tools.get('make_method_note').execute(
      { sourceText: 'x', outputPath: 'knowledge-base/methods/good.md' },
      { signal },
    )
  },
)

await runCase(
  'recall falls back when LLM ranking fails',
  async function* () {
    throw new Error('LLM unavailable')
  },
  async (tools) => {
    const output = await tools.get('recall_methods').execute(
      { query: 'AI 写完材料后需要独立检查是否达标' },
      { signal },
    )
    if (!output.includes('maker-checker')) {
      throw new Error('fallback recall did not find maker-checker')
    }
  },
)

await runCase(
  'expect-fail: fusion note missing sources',
  async function* () {
    yield {
      type: 'text-delta',
      text: [
        '---',
        'type: 融合',
        'title: bad-fusion',
        'tags: [bad]',
        '---',
        '',
        '# bad fusion',
        '',
        '## 新视角',
        '',
        '## 核心 Idea',
        '',
        '## 为什么值得探索',
        '',
        '## 可验证方向',
      ].join('\n'),
    }
    yield { type: 'finish', reason: { kind: 'stop' } }
  },
  async (tools) => {
    await tools.get('make_fusion_idea').execute(
      { sourceText: 'x', sourceTitles: 'A, B', outputPath: 'knowledge-base/wiki/bad.md' },
      { signal },
    )
  },
)

console.log('--- failure-case self-check passed ---')
