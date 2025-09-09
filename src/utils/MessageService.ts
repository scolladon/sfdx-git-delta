import { Messages } from '@salesforce/core'
import { PLUGIN_NAME } from '../constant/libConstant.js'
import { TraceSyncMethod } from './LoggingDecorator.js'

export class MessageService {
  private static instance: Messages<string>

  constructor() {
    if (!MessageService.instance) {
      Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
      MessageService.instance = Messages.loadMessages(PLUGIN_NAME, 'delta')
    }
  }

  @TraceSyncMethod
  getMessage(key: string, tokens?: string[]): string {
    return MessageService.instance.getMessage(key, tokens)
  }

  @TraceSyncMethod
  getMessages(key: string, tokens?: string[]): string[] {
    return MessageService.instance.getMessages(key, tokens)
  }
}
