import '@deepseek-ai/dsh-tools'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import type { Config } from '../config.js'
import { streamText } from '../lib/llm.js'
import { saveText } from '../lib/fs.js'
import { assertNote } from '../lib/note-validate.js'

function buildPrompt(args: { rawText: string; sourceTitle?: string; title?: string }) {
  return [
    '请把下面这段原始资料整理成一篇“认知类型”的 Wiki 笔记。',
    '只输出 Markdown，不要输出解释。',
    '',
    '输出格式必须严格如下：',
    '---',
    'type: 认知',
    'tags: [关键词1, 关键词2]',
    '---',
    '',
    '# 笔记标题',
    '',
    '来源：[[来源文件名]]',
    '',
    '## 摘要',
    '',
    '## 关键点',
    '',
    '- ...',
    '',
    '要求：',
    '- 标题：' + (args.title ?? '根据内容概括，简洁准确') + '；',
    '- 来源：' + (args.sourceTitle ?? '待补充') + '；',
    '- 摘要：1-3 句话；',
    '- 关键点：3-5 条，结构化、便于复习；',
    '- 不添加原文没有的事实。',
    '',
    '原始资料：',
    args.rawText,
  ].join('\n')
}

export function registerCognitiveNoteTool(ctx: Context, config: Config) {
  ctx.tools.register(
    defineTool({
      name: 'make_cognitive_note',
      description: '把一段原始资料整理成结构化、可复习的认知类型 Wiki 笔记。',
      parameters: {
        rawText: {
          type: 'string',
          required: true,
          description: '原始资料内容',
        },
        sourceTitle: {
          type: 'string',
          description: '来源标题或文件名',
        },
        title: {
          type: 'string',
          description: '笔记标题，缺省时由 AI 生成',
        },
        outputPath: {
          type: 'string',
          description: '可选：把生成的笔记保存到该路径',
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
          '你是一位严谨、简洁、准确的知识管理助手。',
          exec.signal,
        ), '认知')

        if (args.outputPath) {
          const cwd = exec.agent?.session.header.cwd ?? '.'
          const save = await saveText(ctx, args.outputPath, text, cwd, exec.signal)
          return `${text}\n\n---\n已保存：${save.displayPath}（${save.operation}）`
        }

        return text
      },
    }),
  )
  console.log('[dsh-knowledge-transform] tool registered: make_cognitive_note')
}
