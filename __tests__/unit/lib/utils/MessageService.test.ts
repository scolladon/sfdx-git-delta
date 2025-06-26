'use strict'

import { describe, expect, it } from '@jest/globals'
import { MessageService } from '../../../../src/utils/MessageService.js'

const mockedMessages = jest.fn()
jest.mock('@salesforce/core', () => {
  return {
    Messages: {
      importMessagesDirectoryFromMetaUrl: jest.fn(),
      loadMessages: jest.fn(() => ({
        getMessage: mockedMessages,
        getMessages: mockedMessages,
      })),
    },
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
