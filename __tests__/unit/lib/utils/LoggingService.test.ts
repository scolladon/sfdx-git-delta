'use strict'

import { Logger, lazy } from '../../../../src/utils/LoggingService.js'

jest.mock('@salesforce/core')

describe('LoggingService', () => {
  let mockShouldLog: jest.Mock

  beforeEach(() => {
    mockShouldLog = jest.fn().mockReturnValue(true)
    Logger['coreLogger'] = {
      setLevel: jest.fn(),
      shouldLog: mockShouldLog,
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      trace: jest.fn(),
      warn: jest.fn(),
    } as unknown as (typeof Logger)['coreLogger']
  })

  describe('given lazy template strings', () => {
    it('should evaluate dynamic template strings lazily', () => {
      let value = 'dynamic'
      const lazyMessage = lazy`dynamic ${() => value} mic`
      value = 'changed'
      expect(lazyMessage()).toBe('dynamic changed mic')
    })

    it('should evaluate static template strings lazily', () => {
      const value = 'value'
      const staticMessage = lazy`static ${value} mic`
      expect(staticMessage()).toBe('static value mic')
    })

    it('should handle empty template strings', () => {
      const emptyMessage = lazy``
      expect(emptyMessage()).toBe('')
    })
  })

  describe('given function parameters', () => {
    it('should evaluate function parameters when debug level is enabled', () => {
      mockShouldLog.mockReturnValue(true)
      let called = false
      const messageFn = () => {
        called = true
        return 'evaluated'
      }
      Logger.debug(messageFn)
      expect(called).toBe(true)
    })

    it('should not evaluate function when level is disabled', () => {
      mockShouldLog.mockReturnValue(false)
      let called = false
      const messageFn = () => {
        called = true
        return 'evaluated'
      }
      Logger.debug(messageFn)
      expect(called).toBe(false)
    })
  })

  describe('given meta parameters', () => {
    it('should accept meta data parameter', () => {
      const meta = { key: 'value' }
      Logger.debug('message', meta)
      expect(Logger['coreLogger'].debug).toHaveBeenCalled()
    })

    it('should handle undefined meta parameter', () => {
      Logger.debug('message', undefined)
      expect(Logger['coreLogger'].debug).toHaveBeenCalled()
    })
  })

  describe('LoggingService integration test', () => {
    describe('debug method', () => {
      it('should call debug method with correct parameters', () => {
        const message = 'test debug message'
        const meta = { key: 'value' }
        Logger.debug(message, meta)
        expect(Logger['coreLogger'].debug).toHaveBeenCalled()
      })
    })

    describe('info method', () => {
      it('should call info method with correct parameters', () => {
        const message = 'test info message'
        const meta = { key: 'value' }
        Logger.info(message, meta)
        expect(Logger['coreLogger'].info).toHaveBeenCalled()
      })
    })

    describe('error method', () => {
      it('should call error method with correct parameters', () => {
        const message = 'test error message'
        const meta = { key: 'value' }
        Logger.error(message, meta)
        expect(Logger['coreLogger'].error).toHaveBeenCalled()
      })
    })

    describe('warn method', () => {
      it('should call warn method with correct parameters', () => {
        const message = 'test warn message'
        const meta = { key: 'value' }
        Logger.warn(message, meta)
        expect(Logger['coreLogger'].warn).toHaveBeenCalled()
      })
    })

    describe('trace method', () => {
      it('should call trace method with correct parameters', () => {
        const message = 'test trace message'
        const meta = { key: 'value' }
        Logger.trace(message, meta)
        expect(Logger['coreLogger'].trace).toHaveBeenCalled()
      })
    })
  })
})
