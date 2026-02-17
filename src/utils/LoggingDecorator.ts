/** biome-ignore-all lint/suspicious/noExplicitAny: it is dynamic by definition */
import { Logger, lazy } from './LoggingService.js'

export function log(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): void {
  const original = descriptor.value

  descriptor.value = function (...args: any[]) {
    Logger.trace(lazy`${target.constructor.name}.${propertyKey}: entry`)

    const call = () => original.call(this, ...args)

    const logResult = (result: any) => {
      Logger.trace(lazy`${target.constructor.name}.${propertyKey}: exit`)
      return result
    }

    if (original.constructor.name === 'AsyncFunction') {
      return call().then(logResult)
    } else {
      return logResult(call())
    }
  }
}
