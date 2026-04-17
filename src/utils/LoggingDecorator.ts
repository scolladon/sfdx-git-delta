/** biome-ignore-all lint/suspicious/noExplicitAny: it is dynamic by definition */
import { Logger, lazy } from './LoggingService.js'

const ASYNC_CALLABLE_TAGS = new Set([
  '[object AsyncFunction]',
  '[object AsyncGeneratorFunction]',
])

const isAsyncFunction = (fn: unknown): boolean =>
  ASYNC_CALLABLE_TAGS.has(Object.prototype.toString.call(fn))

export function log(
  _target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): void {
  const original = descriptor.value
  const isAsync = isAsyncFunction(original)

  descriptor.value = function (this: object, ...args: any[]) {
    const className = this.constructor.name
    Logger.trace(lazy`${className}.${propertyKey}: entry`)

    const logExit = <T>(result: T): T => {
      Logger.trace(lazy`${className}.${propertyKey}: exit`)
      return result
    }

    if (isAsync) {
      return (original.apply(this, args) as Promise<unknown>).then(logExit)
    }
    return logExit(original.apply(this, args))
  }
}
