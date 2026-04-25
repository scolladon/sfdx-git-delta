'use strict'

import { describe, expect, it, vi } from 'vitest'
import { MessageService } from '../../../../src/utils/MessageService.js'

const mockedMessages = vi.fn()
vi.mock('@salesforce/core', () => {
  return {
    Messages: {
      importMessagesDirectoryFromMetaUrl: vi.fn(),
      loadMessages: vi.fn(() => ({
        getMessage: mockedMessages,
        getMessages: mockedMessages,
      })),
    },
    Logger: {
      childFromRoot: vi.fn(() => ({
        setLevel: vi.fn(),
        shouldLog: vi.fn(),
        trace: vi.fn(),
      })),
    },
    LoggerLevel: {},
  }
})

describe('MessageService', () => {
  describe('getMessage', () => {
    it('calls the @salesforce/core implementation', () => {
      // Arrange
      const sut = new MessageService()

      // Act
      sut.getMessage('arg')

      // Assert
      expect(mockedMessages).toHaveBeenCalledWith('arg', undefined)
    })
  })

  describe('getMessages', () => {
    it('calls the @salesforce/core implementation', () => {
      // Arrange
      const sut = new MessageService()

      // Act
      sut.getMessages('arg')

      // Assert
      expect(mockedMessages).toHaveBeenCalledWith('arg', undefined)
    })
  })

  describe('singleton guard (if (!MessageService.instance))', () => {
    it('When two MessageService instances are constructed, Then the second construction does not call Messages.loadMessages again', async () => {
      // Arrange — vitest clears mock call history between tests (clearMocks:
      // true in config) but does NOT reset modules, so the static `instance`
      // already set by prior tests is still in place.  The guard
      // `if (!MessageService.instance)` means the constructor body is skipped
      // on any subsequent construction in the same module lifecycle.
      const { Messages } = await import('@salesforce/core')
      const loadMessagesMock = Messages.loadMessages as ReturnType<typeof vi.fn>
      // Call count is 0 here because clearMocks wiped it before this test.

      // Act — construct a fresh instance; instance is already set so the
      // guard must be false and loadMessages must NOT be called.
      new MessageService()

      // Assert — guard prevents re-initialization
      expect(loadMessagesMock).toHaveBeenCalledTimes(0)
    })
  })
})
