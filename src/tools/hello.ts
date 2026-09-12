import '@deepseek-ai/dsh-tools'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import type { Config } from '../config.js'

export function registerTools(ctx: Context, config: Config) {
  ctx.tools.register(
    defineTool({
      name: 'greet',
      description: 'Greet someone by name.',
      parameters: {
        name: {
          type: 'string',
          required: true,
          description: 'The name to greet',
        },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute(args) {
        return `${config.greeting}, ${args.name}!`
      },
    }),
  )
  console.log('[dsh-knowledge-transform] tool registered: greet')
}
