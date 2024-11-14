import { Messages } from '@salesforce/core'

export class MessageService {
  private static instance: Messages<string>

  constructor() {
    if (!MessageService.instance) {
      Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
      MessageService.instance = Messages.loadMessages('sfdx-git-delta', 'delta')
    }
  }

  getMessage(key: string, tokens?: string[]): string {
    return MessageService.instance.getMessage(key, tokens)
  }

  getMessages(key: string, tokens?: string[]): string[] {
    return MessageService.instance.getMessages(key, tokens)
  }
}
