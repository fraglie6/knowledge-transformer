import Schema from '@deepseek-ai/schemastery'

export interface Config {
  greeting: string
  provider: string
  model: string
  methodsRoot: string
  maxRecall: number
}

export const Config = Schema.object({
  greeting: Schema.string().default('Hello'),
  provider: Schema.string().default('deepseek-official'),
  model: Schema.string().default('deepseek-v4-flash'),
  methodsRoot: Schema.string().default('knowledge-base/methods'),
  maxRecall: Schema.number().default(3),
})
