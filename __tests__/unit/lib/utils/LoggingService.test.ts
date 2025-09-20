'use strict'

import { Logger, lazy } from '../../../../src/utils/LoggingService.js'

jest.mock('@salesforce/core')

describe('LoggingService', () => {
  let mockShouldLog: jest.Mock
  let mockDebug: jest.Mock
  let mockError: jest.Mock
  let mockInfo: jest.Mock
  let mockTrace: jest.Mock
  let mockWarn: jest.Mock

  beforeEach(() => {
    mockShouldLog = jest.fn().mockReturnValue(true)
    mockDebug = jest.fn()
    mockError = jest.fn()
    mockInfo = jest.fn()
    mockTrace = jest.fn()
    mockWarn = jest.fn()

    Logger['coreLogger'] = {
      setLevel: jest.fn(),
      shouldLog: mockShouldLog,
      debug: mockDebug,
      error: mockError,
      info: mockInfo,
      trace: mockTrace,
      warn: mockWarn,
    } as unknown as (typeof Logger)['coreLogger']
  })

  describe('lazy', () => {
    describe('given dynamic template strings', () => {
      it('should evaluate expressions at call time', () => {
        // Arrange
        let value = 'dynamic'
        const sut = lazy`dynamic ${() => value} mic`

        // Act
        value = 'changed'
        const result = sut()

        // Assert
        expect(result).toBe('dynamic changed mic')
      })
    })

    describe('given static template strings', () => {
      it('should evaluate static values correctly', () => {
        // Arrange
        const value = 'value'
        const sut = lazy`static ${value} mic`

        // Act
        const result = sut()

        // Assert
        expect(result).toBe('static value mic')
      })
    })

    describe('given empty template strings', () => {
      it('should return empty string', () => {
        // Arrange
        const sut = lazy``

        // Act
        const result = sut()

        // Assert
        expect(result).toBe('')
      })
    })
  })

  describe('Logger.debug', () => {
    describe('when logging level is enabled', () => {
      it('should evaluate function message and call core logger', () => {
        // Arrange
        mockShouldLog.mockReturnValue(true)
        let called = false
        const messageFn = () => {
          called = true
          return 'evaluated'
        }

        // Act
        Logger.debug(messageFn)

        // Assert
        expect(called).toBe(true)
        expect(mockDebug).toHaveBeenCalledWith('evaluated', undefined)
      })

      it('should call core logger with string message and meta', () => {
        // Arrange
        const message = 'test debug message'
        const meta = { key: 'value' }

        // Act
        Logger.debug(message, meta)

        // Assert
        expect(mockDebug).toHaveBeenCalledWith(message, meta)
      })
    })

    describe('when logging level is disabled', () => {
      it('should not evaluate function message', () => {
        // Arrange
        mockShouldLog.mockReturnValue(false)
        let called = false
        const messageFn = () => {
          called = true
          return 'evaluated'
        }

        // Act
        Logger.debug(messageFn)

        // Assert
        expect(called).toBe(false)
        expect(mockDebug).not.toHaveBeenCalled()
      })
    })
  })

  describe('Logger.error', () => {
    describe('when logging level is enabled', () => {
      it('should call core logger with message and meta', () => {
        // Arrange
        const message = 'test error message'
        const meta = { key: 'value' }

        // Act
        Logger.error(message, meta)

        // Assert
        expect(mockError).toHaveBeenCalledWith(message, meta)
      })
    })

    describe('when logging level is disabled', () => {
      it('should not evaluate function message', () => {
        // Arrange
        mockShouldLog.mockReturnValue(false)
        let called = false
        const messageFn = () => {
          called = true
          return 'evaluated'
        }

        // Act
        Logger.error(messageFn)

        // Assert
        expect(called).toBe(false)
        expect(mockError).not.toHaveBeenCalled()
      })
    })
  })

  describe('Logger.info', () => {
    describe('when logging level is enabled', () => {
      it('should call core logger with message and meta', () => {
        // Arrange
        const message = 'test info message'
        const meta = { key: 'value' }

        // Act
        Logger.info(message, meta)

        // Assert
        expect(mockInfo).toHaveBeenCalledWith(message, meta)
      })
    })

    describe('when logging level is disabled', () => {
      it('should not evaluate function message', () => {
        // Arrange
        mockShouldLog.mockReturnValue(false)
        let called = false
        const messageFn = () => {
          called = true
          return 'evaluated'
        }

        // Act
        Logger.info(messageFn)

        // Assert
        expect(called).toBe(false)
        expect(mockInfo).not.toHaveBeenCalled()
      })
    })
  })

  describe('Logger.trace', () => {
    describe('when logging level is enabled', () => {
      it('should call core logger with message and meta', () => {
        // Arrange
        const message = 'test trace message'
        const meta = { key: 'value' }

        // Act
        Logger.trace(message, meta)

        // Assert
        expect(mockTrace).toHaveBeenCalledWith(message, meta)
      })
    })

    describe('when logging level is disabled', () => {
      it('should not evaluate function message', () => {
        // Arrange
        mockShouldLog.mockReturnValue(false)
        let called = false
        const messageFn = () => {
          called = true
          return 'evaluated'
        }

        // Act
        Logger.trace(messageFn)

        // Assert
        expect(called).toBe(false)
        expect(mockTrace).not.toHaveBeenCalled()
      })
    })
  })

  describe('Logger.warn', () => {
    describe('when logging level is enabled', () => {
      it('should call core logger with message and meta', () => {
        // Arrange
        const message = 'test warn message'
        const meta = { key: 'value' }

        // Act
        Logger.warn(message, meta)

        // Assert
        expect(mockWarn).toHaveBeenCalledWith(message, meta)
      })
    })

    describe('when logging level is disabled', () => {
      it('should not evaluate function message', () => {
        // Arrange
        mockShouldLog.mockReturnValue(false)
        let called = false
        const messageFn = () => {
          called = true
          return 'evaluated'
        }

        // Act
        Logger.warn(messageFn)

        // Assert
        expect(called).toBe(false)
        expect(mockWarn).not.toHaveBeenCalled()
      })
    })
  })
})
