import '@deepseek-ai/dsh-llm'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Context } from '@deepseek-ai/cordis'
import type { Config } from '../config.js'

export async function streamText(
  ctx: Context,
  config: Config,
  prompt: string,
  system: string,
  signal: AbortSignal,
): Promise<string> {
  let text = ''

  for await (const chunk of ctx.llm.stream({
    provider: config.provider,
    model: config.model,
    system,
    messages: [
      createUserMessage({
        source: { kind: 'user' },
        content: [{ type: 'text', text: prompt }],
      }),
    ],
    signal,
  })) {
    if (chunk.type === 'text-delta') {
      text += chunk.text
    } else if (chunk.type === 'finish' && chunk.reason?.kind === 'error') {
      throw new Error(chunk.reason.failure?.message ?? 'LLM stream failed')
    }
  }

  return text
}
