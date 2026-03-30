'use strict'

import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'

vi.mock('../../../../src/utils/LoggingService')

import { log } from '../../../../src/utils/LoggingDecorator.js'
import { Logger } from '../../../../src/utils/LoggingService.js'

const mockedTrace = Logger.trace as Mock

describe('LoggingDecorator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('log', () => {
    describe('Given a sync method', () => {
      it('When called, Then traces entry and exit', () => {
        // Arrange
        class TestClass {
          @log
          syncMethod() {
            return 'result'
          }
        }
        const sut = new TestClass()

        // Act
        const result = sut.syncMethod()

        // Assert
        expect(result).toBe('result')
        expect(mockedTrace).toHaveBeenCalledTimes(2)
        const entryMsg = (mockedTrace.mock.calls[0][0] as () => string)()
        const exitMsg = (mockedTrace.mock.calls[1][0] as () => string)()
        expect(entryMsg).toContain('syncMethod: entry')
        expect(exitMsg).toContain('syncMethod: exit')
      })

      it('When called with arguments, Then passes arguments through', () => {
        // Arrange
        class TestClass {
          @log
          syncMethod(a: string, b: number) {
            return `${a}-${b}`
          }
        }
        const sut = new TestClass()

        // Act
        const result = sut.syncMethod('hello', 42)

        // Assert
        expect(result).toBe('hello-42')
      })
    })

    describe('Given an async method', () => {
      it('When called, Then traces entry and exit', async () => {
        // Arrange
        class TestClass {
          @log
          async asyncMethod() {
            return 'async-result'
          }
        }
        const sut = new TestClass()

        // Act
        const result = await sut.asyncMethod()

        // Assert
        expect(result).toBe('async-result')
        expect(mockedTrace).toHaveBeenCalledTimes(2)
        const entryMsg = (mockedTrace.mock.calls[0][0] as () => string)()
        const exitMsg = (mockedTrace.mock.calls[1][0] as () => string)()
        expect(entryMsg).toContain('asyncMethod: entry')
        expect(exitMsg).toContain('asyncMethod: exit')
      })

      it('When called with arguments, Then passes arguments through', async () => {
        // Arrange
        class TestClass {
          @log
          async asyncMethod(a: string, b: number) {
            return `${a}-${b}`
          }
        }
        const sut = new TestClass()

        // Act
        const result = await sut.asyncMethod('hello', 42)

        // Assert
        expect(result).toBe('hello-42')
      })
    })

    describe('Given Logger mock receives non-function message', () => {
      it('When called with a string, Then does not throw', () => {
        // Act & Assert
        expect(() => Logger.debug('plain string message')).not.toThrow()
        expect(() => Logger.warn('plain string warning')).not.toThrow()
      })
    })
  })
})
