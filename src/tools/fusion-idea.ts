import '@deepseek-ai/dsh-tools'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import type { Config } from '../config.js'
import { streamText } from '../lib/llm.js'
import { saveText } from '../lib/fs.js'
import { assertNote } from '../lib/note-validate.js'

function parseSourceTitles(value?: string): string[] {
  if (!value) return []
  return value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildPrompt(args: {
  sourceText: string
  sourceTitles?: string
  title?: string
}): string {
  const sources = parseSourceTitles(args.sourceTitles)

  return [
    '请把下面给出的原始资料，融合成一篇「融合」类型的笔记。',
    '重点不是复述原文，而是找出这些资料之间互相碰撞后产生的新视角、新 idea。',
    '只输出 Markdown，不要输出解释。',
    '',
    '输出格式必须严格如下：',
    '---',
    'type: 融合',
    'title: 融合笔记标题',
    'sources: [来源1, 来源2]',
    'tags: [标签1, 标签2]',
    '---',
    '',
    '# 融合笔记标题',
    '',
    '融合来源：',
    '- [[来源1]]',
    '- [[来源2]]',
    '',
    '## 新视角',
    '',
    '## 核心 Idea',
    '',
    '## 为什么值得探索',
    '',
    '## 可验证方向',
    '',
    '要求：',
    '- 标题：' + (args.title ?? '根据内容概括，简洁准确') + '；',
    '- frontmatter 的 title 与正文一级标题保持一致；',
    '- 融合来源必须明确列出：' + (sources.length > 0 ? sources.join('、') : '待补充') + '；',
    '- 新视角与核心 Idea 要明显超出任何单一来源，体现交叉后产生的新东西；',
    '- 核心 Idea 要具体、可自圆其说，避免空泛总结；',
    '- 不添加任何一篇原始资料都没有的事实。',
    '',
    '原始资料：',
    args.sourceText,
  ].join('\n')
}

export function registerFusionIdeaTool(ctx: Context, config: Config) {
  ctx.tools.register(
    defineTool({
      name: 'make_fusion_idea',
      description: '把多段原始资料融合成一篇提出新视角、新 idea 的融合笔记。',
      parameters: {
        sourceText: {
          type: 'string',
          required: true,
          description: '融合来源笔记内容，可包含多段资料',
        },
        sourceTitles: {
          type: 'string',
          description: '逗号分隔的来源名称，例如「方法A, 认知B」',
        },
        title: {
          type: 'string',
          description: '融合笔记标题，缺省时由 AI 生成',
        },
        outputPath: {
          type: 'string',
          description: '可选：把生成的融合笔记保存到该路径',
        },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute(args, exec) {
        const prompt = buildPrompt(args)
        const text = assertNote(await streamText(
          ctx,
          config,
          prompt,
          '你是一位擅长跨领域联想与知识融合的创新研究者。',
          exec.signal,
        ), '融合')

        if (args.outputPath) {
          const cwd = exec.agent?.session.header.cwd ?? '.'
          const save = await saveText(ctx, args.outputPath, text, cwd, exec.signal)
          return `${text}\n\n---\n已保存：${save.displayPath}（${save.operation}）`
        }

        return text
      },
    }),
  )
  console.log('[dsh-knowledge-transform] tool registered: make_fusion_idea')
}
