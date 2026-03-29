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
})
