import type { Context } from '@deepseek-ai/cordis'
import { Config } from './config.js'
import type { Config as ConfigType } from './config.js'
import { registerTools as registerGreetTool } from './tools/hello.js'
import { registerCognitiveNoteTool } from './tools/cognitive-note.js'
import { registerRecallMethodsTool } from './tools/recall-methods.js'
import { registerMethodNoteTool } from './tools/method-note.js'
import { registerFusionIdeaTool } from './tools/fusion-idea.js'
import { registerMethodInjection } from './events/method-injection.js'

export const name = 'dsh-knowledge-transform'
export const inject = ['tools', 'llm', 'fs']
export { Config }

export function apply(ctx: Context, config: ConfigType) {
  registerGreetTool(ctx, config)
  registerCognitiveNoteTool(ctx, config)
  registerMethodNoteTool(ctx, config)
  registerFusionIdeaTool(ctx, config)
  registerRecallMethodsTool(ctx, config)
  registerMethodInjection(ctx, config)
  console.log('[dsh-knowledge-transform] plugin loaded')
}
