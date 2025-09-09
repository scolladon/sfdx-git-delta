import { Logger as LoggerService } from '@salesforce/core'
import { PLUGIN_NAME } from '../constant/libConstant.js'

export class LoggingService {
  private static logger: CoreLogger

  public constructor() {
    if (!LoggingService.logger) {
      LoggingService.logger = LoggerService.childFromRoot(PLUGIN_NAME)
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
