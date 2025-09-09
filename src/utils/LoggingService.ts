import { Logger as CoreLogger } from '@salesforce/core'
import { PLUGIN_NAME } from '../constant/libConstant.js'

class LoggingService {
  private static logger: CoreLogger

  constructor() {
    if (!LoggingService.logger) {
      LoggingService.logger = CoreLogger.childFromRoot(PLUGIN_NAME)
      LoggingService.logger.setLevel()
    }
  }

  debug(message: string, meta?: unknown): void {
    LoggingService.logger.debug(message, meta)
  }

  error(message: string, meta?: unknown): void {
    LoggingService.logger.error(message, meta)
  }

  fatal(message: string, meta?: unknown): void {
    LoggingService.logger.fatal(message, meta)
  }

  info(message: string, meta?: unknown): void {
    LoggingService.logger.info(message, meta)
  }

  trace(message: string, meta?: unknown): void {
    LoggingService.logger.trace(message, meta)
  }

  warn(message: string, meta?: unknown): void {
    LoggingService.logger.warn(message, meta)
  }
}

export const Logger = new LoggingService()
