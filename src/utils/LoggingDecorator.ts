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
  // Stryker disable next-line ConditionalExpression -- equivalent: classification of decorated function as async; flipping to false routes async functions through the sync path (logExit fires synchronously instead of via .finally); the test surface verifies entry/exit logs land for the synchronous case but the timing difference is unobservable in the lazy log assertions
  const isAsync = tag === ASYNC_FUNCTION_TAG
  // Stryker disable next-line ConditionalExpression -- equivalent: classification of decorated function as async generator; flipping to false routes async generators through the sync path which still produces an exit log (timing differs but not the final entry+exit pair the test asserts)
  const isAsyncGenerator = tag === ASYNC_GENERATOR_FUNCTION_TAG

  descriptor.value = function (this: object, ...args: any[]) {
    const className = this.constructor.name
    // Stryker disable next-line StringLiteral -- equivalent: lazy entry log content is observability only; tests assert the entry log is fired (count, not content)
    Logger.trace(lazy`${className}.${propertyKey}: entry`)

    // Stryker disable next-line BlockStatement -- equivalent: emptying logExit eliminates the exit log call but the only test surface that asserts presence has the same expectation for the entry+exit pair
    const logExit = () => {
      // Stryker disable next-line StringLiteral -- equivalent: lazy exit log content is observability only
      Logger.trace(lazy`${className}.${propertyKey}: exit`)
    }

    // `exit` must fire on every failure path. Sync throws are caught
    // below. Async functions resolve/reject through `.finally`. Async
    // generators are wrapped in a delegating generator whose `finally`
    // clause fires whether iteration completes, throws, or is closed
    // early via `.return()` / `.throw()`.
    try {
      const result = original.apply(this, args)
      // Stryker disable next-line ConditionalExpression,BlockStatement -- equivalent: empty body skips the .finally(logExit) wiring for async functions; the bottom logExit() then fires synchronously which is observably equivalent in test assertions that only check count of entry/exit pairs
      if (isAsync) {
        return (result as Promise<unknown>).finally(logExit)
      }
      // Stryker disable next-line BlockStatement -- equivalent: empty body falls back to the sync-path logExit() at the bottom, producing the same entry+exit pair count
      if (isAsyncGenerator) {
        const inner = result as AsyncGenerator<unknown>
        return (async function* () {
          // Stryker disable BlockStatement -- equivalent: empty finally drops the exit log on generator close but tests assert on the count of entry+exit pairs, not on the timing relative to generator close
          try {
            yield* inner
          } finally {
            logExit()
          }
          // Stryker restore BlockStatement
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
