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

    const logExit = () => {
      Logger.trace(lazy`${className}.${propertyKey}: exit`)
    }

    // `exit` must fire on every failure path, including when `.apply()`
    // itself throws synchronously (possible for non-async functions, and
    // for transpiled-down async wrappers that don't convert sync throws
    // to rejections). The outer try/catch covers that. For genuine async
    // returns, `.finally` covers the resolve/reject paths.
    try {
      const result = original.apply(this, args)
      if (isAsync) {
        return (result as Promise<unknown>).finally(logExit)
      }
      logExit()
      return result
    } catch (error) {
      logExit()
      throw error
    }
  }
}
