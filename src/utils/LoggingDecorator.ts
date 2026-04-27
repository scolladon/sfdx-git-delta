/** biome-ignore-all lint/suspicious/noExplicitAny: it is dynamic by definition */
import { Logger, lazy } from './LoggingService.js'

const ASYNC_FUNCTION_TAG = '[object AsyncFunction]'
const ASYNC_GENERATOR_FUNCTION_TAG = '[object AsyncGeneratorFunction]'

const tagOf = (fn: unknown): string => Object.prototype.toString.call(fn)

export function log(
  _target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): void {
  const original = descriptor.value
  const tag = tagOf(original)
  const isAsync = tag === ASYNC_FUNCTION_TAG
  const isAsyncGenerator = tag === ASYNC_GENERATOR_FUNCTION_TAG

  descriptor.value = function (this: object, ...args: any[]) {
    const className = this.constructor.name
    Logger.trace(lazy`${className}.${propertyKey}: entry`)

    const logExit = () => {
      Logger.trace(lazy`${className}.${propertyKey}: exit`)
    }

    // `exit` must fire on every failure path. Sync throws are caught
    // below. Async functions resolve/reject through `.finally`. Async
    // generators are wrapped in a delegating generator whose `finally`
    // clause fires whether iteration completes, throws, or is closed
    // early via `.return()` / `.throw()`.
    try {
      const result = original.apply(this, args)
      if (isAsync) {
        return (result as Promise<unknown>).finally(logExit)
      }
      if (isAsyncGenerator) {
        const inner = result as AsyncGenerator<unknown>
        return (async function* () {
          try {
            yield* inner
          } finally {
            logExit()
          }
        })()
      }
      logExit()
      return result
    } catch (error) {
      logExit()
      throw error
    }
  }
}
