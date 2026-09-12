import { readFile, readdir } from 'node:fs/promises'

const methodsRoot = new URL('../knowledge-base/methods/', import.meta.url)
const fileNames = (await readdir(methodsRoot)).filter((name) => name.endsWith('.md'))
const files = new Map()

for (const name of fileNames) {
  files.set(name, await readFile(new URL(name, methodsRoot), 'utf8'))
}

const index = JSON.parse(await readFile(new URL('index.json', methodsRoot), 'utf8'))
let injected

const ctx = {
  tools: {
    register() {},
  },
  fs: {
    async resolve(path) {
      return { displayPath: path }
    },
    async stat(target) {
      if (target.displayPath.endsWith('index.json')) return { type: 'file' }
      return { type: 'file' }
    },
    async listDir() {
      return fileNames.map((name) => ({ name, type: 'file', target: { displayPath: name } }))
    },
    async readText(target) {
      if (target.displayPath.endsWith('index.json')) return JSON.stringify(index)
      const key = target.displayPath.split('/').pop() ?? target.displayPath
      return files.get(key) ?? ''
    },
  },
  on(event, handler) {
    if (event === 'agent/pre-step') injected = handler
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

if (!injected) throw new Error('agent/pre-step handler was not registered')

const decision = await injected(
  {
    agent: { session: { header: { cwd: '.' } } },
    messages: [{ content: [{ text: 'AI 写完材料后需要独立检查是否达标' }] }],
    signal: new AbortController().signal,
  },
  async () => ({
    kind: 'enter',
    messages: [{ content: [{ text: 'original' }] }],
  }),
)

const firstText = decision.messages[0].content[0].text

if (!firstText.includes('方法笔记')) {
  throw new Error('expected method notes to be injected')
}

console.log('--- method injection output ---')
console.log(firstText)
console.log('--- injection self-check passed ---')
