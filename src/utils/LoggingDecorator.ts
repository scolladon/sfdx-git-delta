/** biome-ignore-all lint/suspicious/noExplicitAny: it is dynamic by definition */
import { Logger } from './LoggingService.js'

export function TraceSyncMethod(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const original = descriptor.value

  descriptor.value = function (...args: any[]) {
    Logger.trace(`${target.constructor.name}.${propertyKey}: entry`, args)
    const result = original.call(this, ...args)
    Logger.trace(`${target.constructor.name}.${propertyKey}: exit`, result)
    return result
  }
}

export function TraceAsyncMethod(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const original = descriptor.value

  descriptor.value = async function (...args: any[]) {
    Logger.trace(`${target.constructor.name}.${propertyKey}: entry`, args)
    const result = await original.call(this, ...args)
    Logger.trace(`${target.constructor.name}.${propertyKey}: exit`, result)
    return result
  }
}
