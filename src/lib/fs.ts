import '@deepseek-ai/dsh-fs'
import type { Context } from '@deepseek-ai/cordis'

export async function saveText(
  ctx: Context,
  outputPath: string,
  content: string,
  cwd: string,
  signal: AbortSignal,
): Promise<{ displayPath: string; operation: string }> {
  const target = await ctx.fs.resolve(outputPath, { cwd, signal })
  const outcome = await ctx.fs.writeText(target, content, undefined, signal)
  return { displayPath: target.displayPath, operation: outcome.operation }
}
