export type Config = {
  to: string
  from: string
  output: string
  source: string
  ignore: string
  ignoreDestructive: string
  apiVersion: number
  repo: string
  ignoreWhitespace: boolean
  generateDelta: boolean
  include: string
  includeDestructive: string
}
