/** biome-ignore-all lint/suspicious/noExplicitAny: it is dynamic by definition */
import { Logger, lazy } from './LoggingService.js'

function stringify(value: unknown) {
  if (hasCustomToString(value)) {
    return value.toString()
  }
  return JSON.stringify(value, replacer)
}

function replacer(_key: string, value: unknown) {
  if (value instanceof Map) {
    return Array.from(value.entries())
  }
  if (value instanceof Set) {
    return Array.from(value)
  }
  return value
}

function hasCustomToString(obj: unknown): obj is { toString: () => string } {
  if (obj === null || typeof obj !== 'object') return false

  const toStringFn = (obj as any).toString
  if (typeof toStringFn !== 'function') return false

  if (Object.hasOwn(obj, 'toString')) {
    return toStringFn !== Object.prototype.toString
  }
  const proto = Object.getPrototypeOf(obj)
  if (!proto) return false

  const protoToString = proto.toString
  return (
    typeof protoToString === 'function' &&
    protoToString !== Object.prototype.toString
  )
}

export function log(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const original = descriptor.value

  descriptor.value = function (...args: any[]) {
    Logger.trace(lazy`${target.constructor.name}.${propertyKey}: entry`)
    Logger.debug(
      lazy`${target.constructor.name}.${propertyKey}: arguments : ${stringify(args)}`
    )

    const call = () => original.call(this, ...args)

    const logResult = (result: any) => {
      Logger.debug(
        lazy`${target.constructor.name}.${propertyKey}: result : ${stringify(result)}`
      )
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
