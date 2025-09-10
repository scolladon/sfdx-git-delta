import { Logger as CoreLogger } from '@salesforce/core'
import { PLUGIN_NAME } from '../constant/libConstant.js'

export class Logger {
  private static coreLogger: CoreLogger = (() => {
    const coreLogger = CoreLogger.childFromRoot(PLUGIN_NAME)
    coreLogger.setLevel()
    return coreLogger
  })()

  static debug(message: string, meta?: unknown): void {
    Logger.coreLogger.debug(message, meta)
  }

  static error(message: string, meta?: unknown): void {
    Logger.coreLogger.error(message, meta)
  }

  static info(message: string, meta?: unknown): void {
    Logger.coreLogger.info(message, meta)
  }

  static trace(message: string, meta?: unknown): void {
    Logger.coreLogger.trace(message, meta)
  }

  static warn(message: string, meta?: unknown): void {
    Logger.coreLogger.warn(message, meta)
  }
}
