import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const methodsRoot = new URL('../knowledge-base/methods/', import.meta.url)
const fileNames = (await readdir(methodsRoot)).filter((name) => name.endsWith('.md'))
const files = new Map()

for (const name of fileNames) {
  files.set(name, await readFile(new URL(name, methodsRoot), 'utf8'))
}

let recallTool

const ctx = {
  tools: {
    register(tool) {
      if (tool.name === 'recall_methods') recallTool = tool
    },
  },
  fs: {
    async resolve(path) {
      return { displayPath: path }
    },
    async listDir() {
      return fileNames.map((name) => ({ name, type: 'file', target: { displayPath: name } }))
    },
    async readText(target) {
      const key = target.displayPath.split('/').pop() ?? target.displayPath
      return files.get(key) ?? ''
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

const output = await recallTool.execute(
  {
    query: 'AI 写完了材料，但我担心它说做完了，其实没有达标，需要独立检查',
  },
  { signal: new AbortController().signal },
)

console.log('--- recall_methods output ---')
console.log(output)

if (!output.includes('maker-checker')) {
  throw new Error('expected maker-checker method to be recalled')
}

console.log('--- recall self-check passed ---')
