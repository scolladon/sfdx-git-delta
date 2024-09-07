export type Config = {
  to: string
  from: string
  output: string
  source: string
  ignore?: string | undefined
  ignoreDestructive?: string | undefined
  apiVersion?: number | undefined
  repo: string
  ignoreWhitespace: boolean
  generateDelta: boolean
  include?: string | undefined
  includeDestructive?: string | undefined
}
