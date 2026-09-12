import '@deepseek-ai/dsh-tools'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import type { Config } from '../config.js'
import { streamText } from '../lib/llm.js'
import { saveText } from '../lib/fs.js'
import { assertNote } from '../lib/note-validate.js'

function buildPrompt(args: {
  sourceText: string
  sourceTitle?: string
  title?: string
  role?: string
}) {
  return [
    '请把下面这段资料蒸馏成一个可复用的方法论 / 方法笔记。',
    '只输出 Markdown，不要输出解释。',
    '',
    '输出格式必须严格如下：',
    '---',
    'type: 方法',
    'name: kebab-case-id',
    'description: 一行触发摘要',
    'whenToUse: 什么场景或症状下使用',
    'tags: [标签1, 标签2]',
    'role: ' + (args.role ?? 'generalist'),
    '---',
    '',
    '# 方法标题',
    '',
    '## 何时使用',
    '',
    '## 怎么做',
    '',
    '1. ...',
    '',
    '## 为什么',
    '',
    '## 例子',
    '',
    '要求：',
    '- 标题：' + (args.title ?? '根据内容概括，简洁准确') + '；',
    '- 一篇只讲一个原则；',
    '- 触发条件写成可观察的症状；',
    '- 怎么做要具体、可执行；',
    '- 不添加原文没有的事实。',
    '',
    '原始资料：',
    args.sourceText,
  ].join('\n')
}

export function registerMethodNoteTool(ctx: Context, config: Config) {
  ctx.tools.register(
    defineTool({
      name: 'make_method_note',
      description: '把原始资料或认知笔记蒸馏成一条可复用的方法笔记。',
      parameters: {
        sourceText: {
          type: 'string',
          required: true,
          description: '原始资料或认知笔记内容',
        },
        sourceTitle: {
          type: 'string',
          description: '来源标题或文件名',
        },
        title: {
          type: 'string',
          description: '方法笔记标题，缺省时由 AI 生成',
        },
        role: {
          type: 'string',
          description: '该方法的角色 / 技能包',
        },
        outputPath: {
          type: 'string',
          description: '可选：把生成的方法笔记保存到该路径',
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
          '你是一位擅长把经验提炼成可执行方法论的知识工程师。',
          exec.signal,
        ), '方法')

        if (args.outputPath) {
          const cwd = exec.agent?.session.header.cwd ?? '.'
          const save = await saveText(ctx, args.outputPath, text, cwd, exec.signal)
          return `${text}\n\n---\n已保存：${save.displayPath}（${save.operation}）`
        }

        return text
      },
    }),
  )
  console.log('[dsh-knowledge-transform] tool registered: make_method_note')
}
