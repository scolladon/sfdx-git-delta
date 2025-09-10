'use strict'

import { Logger } from '../../../../src/utils/LoggingService.js'

// As the library is the ACL with the Salesforce logs, it test in integration
// if there are changes in the library, the tests should fail
describe('LoggingService integration test', () => {
  describe('debug method', () => {
    it('should call debug method with correct parameters', () => {
      // Act
      const message = 'test debug message'
      const meta = { key: 'value' }
      Logger.debug(message, meta)

      // Assert
      // This code should be reached
      expect(true).toBeTruthy()
    })
  })

  describe('info method', () => {
    it('should call info method with correct parameters', () => {
      // Act
      const message = 'test info message'
      const meta = { key: 'value' }
      Logger.info(message, meta)

      // Assert
      // This code should be reached
      expect(true).toBeTruthy()
    })
  })

  describe('error method', () => {
    it('should call error method with correct parameters', () => {
      // Act
      const message = 'test error message'
      const meta = { key: 'value' }
      Logger.error(message, meta)

      // Assert
      // This code should be reached
      expect(true).toBeTruthy()
    })
  })

  describe('warn method', () => {
    it('should call warn method with correct parameters', () => {
      // Act
      const message = 'test warn message'
      const meta = { key: 'value' }
      Logger.warn(message, meta)

      // Assert
      // This code should be reached
      expect(true).toBeTruthy()
    })
  })

  describe('trace method', () => {
    it('should call trace method with correct parameters', () => {
      // Act
      const message = 'test trace message'
      const meta = { key: 'value' }
      Logger.trace(message, meta)

      // Assert
      // This code should be reached
      expect(true).toBeTruthy()
    })
  })
})
