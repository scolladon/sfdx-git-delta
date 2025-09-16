import { Logger as CoreLogger, LoggerLevel } from '@salesforce/core'
import { PLUGIN_NAME } from '../constant/libConstant.js'

type LoggerMessage<T = string> = T | (() => T)

function resolveLoggerMessage<T>(message: LoggerMessage<T>): T {
  return typeof message === 'function' ? (message as () => T)() : message
}

// biome-ignore lint/suspicious/noExplicitAny: Any is expected here
export function lazy(strings: TemplateStringsArray, ...exprs: any[]) {
  const getters = exprs.map(expr => {
    if (typeof expr === 'function') return expr
    return () => expr
  })

  return () =>
    strings.reduce(
      (acc, str, i) => acc + str + (i < getters.length ? getters[i]() : ''),
      ''
    )
}

export class Logger {
  private static coreLogger: CoreLogger = (() => {
    const coreLogger = CoreLogger.childFromRoot(PLUGIN_NAME)
    coreLogger.setLevel()
    return coreLogger
  })()

  static debug<T = string>(message: LoggerMessage<T>, meta?: unknown): void {
    if (Logger.coreLogger.shouldLog(LoggerLevel.DEBUG)) {
      const content = resolveLoggerMessage(message)
      Logger.coreLogger.debug(content, meta)
    }
  }

  static error<T = string>(message: LoggerMessage<T>, meta?: unknown): void {
    if (Logger.coreLogger.shouldLog(LoggerLevel.ERROR)) {
      const content = resolveLoggerMessage(message)
      Logger.coreLogger.error(content, meta)
    }
  }

  static info<T = string>(message: LoggerMessage<T>, meta?: unknown): void {
    if (Logger.coreLogger.shouldLog(LoggerLevel.INFO)) {
      const content = resolveLoggerMessage(message)
      Logger.coreLogger.info(content, meta)
    }
  }

  static trace<T = string>(message: LoggerMessage<T>, meta?: unknown): void {
    if (Logger.coreLogger.shouldLog(LoggerLevel.TRACE)) {
      const content = resolveLoggerMessage(message)
      Logger.coreLogger.trace(content, meta)
    }
  }

  static warn<T = string>(message: LoggerMessage<T>, meta?: unknown): void {
    if (Logger.coreLogger.shouldLog(LoggerLevel.WARN)) {
      const content = resolveLoggerMessage(message)
      Logger.coreLogger.warn(content, meta)
    }
  }
}
