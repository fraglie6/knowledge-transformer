import { readFile } from 'node:fs/promises'

const raw = await readFile(
  new URL('../knowledge-base/raw/karpathy-autoresearch-raw.md', import.meta.url),
  'utf8',
)

const tools = new Map()
const saved = new Map()

const ctx = {
  tools: {
    register(tool) {
      tools.set(tool.name, tool)
    },
  },
  llm: {
    async *stream(options) {
      const prompt = options.messages[0].content[0].text
      const system = options.system

      if (system.includes('融合')) {
        yield {
          type: 'text-delta',
          text: [
            '---',
            'type: 融合',
            'title: 方法论驱动的自动科研',
            'sources: [autoresearch, maker-checker]',
            'tags: [自动循环, 独立验收]',
            '---',
            '',
            '# 方法论驱动的自动科研',
            '',
            '融合来源：',
            '- [[autoresearch]]',
            '- [[maker-checker]]',
            '',
            '## 新视角',
            '',
            '把自动循环和独立验收组合，形成可持续科研流水线。',
            '',
            '## 核心 Idea',
            '',
            '让一个 agent 跑循环，另一个 agent 做验收。',
            '',
            '## 为什么值得探索',
            '',
            '这能减少人工干预，同时保留可信检查。',
            '',
            '## 可验证方向',
            '',
            '用一个小任务验证 maker-checker 是否降低错误率。',
          ].join('\n'),
        }
      } else if (system.includes('方法论')) {
        yield {
          type: 'text-delta',
          text: [
            '---',
            'type: 方法',
            'name: direction-over-code',
            'description: 当需要让 agent 自动持续执行任务时。',
            'whenToUse: 用户希望 agent 自动持续执行任务。',
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
            '1. 把方法论写进 program.md。',
            '',
            '## 为什么',
            '',
            '人擅长定方向，agent 擅长执行。',
            '',
            '## 例子',
            '',
            'Karpathy autoresearch。',
          ].join('\n'),
        }
      } else {
        yield {
          type: 'text-delta',
          text: [
            '---',
            'type: 认知',
            'tags: [自动循环, Karpathy]',
            '---',
            '',
            '# Karpathy autoresearch',
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
      }

      yield { type: 'finish', reason: { kind: 'stop' } }
    },
  },
  fs: {
    async resolve(path) {
      return { displayPath: path }
    },
    async writeText(target, content) {
      saved.set(target.displayPath, content)
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

const signal = new AbortController().signal

const cognitive = await tools.get('make_cognitive_note').execute(
  {
    rawText: raw,
    sourceTitle: 'karpathy-autoresearch-raw',
    outputPath: 'knowledge-base/wiki/Karpathy-autoresearch.md',
  },
  { signal },
)

const method = await tools.get('make_method_note').execute(
  {
    sourceText: cognitive,
    sourceTitle: 'Karpathy-autoresearch',
    role: 'reliable-agent',
    outputPath: 'knowledge-base/methods/direction-over-code.md',
  },
  { signal },
)

const fusion = await tools.get('make_fusion_idea').execute(
  {
    sourceText: `${cognitive}\n\n${method}`,
    sourceTitles: 'Karpathy-autoresearch, direction-over-code',
    outputPath: 'knowledge-base/wiki/方法论驱动的自动科研.md',
  },
  { signal },
)

console.log('--- full loop cognitive ---')
console.log(cognitive)
console.log('--- full loop method ---')
console.log(method)
console.log('--- full loop fusion ---')
console.log(fusion)

if (!saved.get('knowledge-base/wiki/Karpathy-autoresearch.md')?.includes('type: 认知')) {
  throw new Error('cognitive note was not saved correctly')
}
if (!saved.get('knowledge-base/methods/direction-over-code.md')?.includes('type: 方法')) {
  throw new Error('method note was not saved correctly')
}
if (!saved.get('knowledge-base/wiki/方法论驱动的自动科研.md')?.includes('type: 融合')) {
  throw new Error('fusion idea was not saved correctly')
}

console.log('--- full-loop self-check passed ---')
