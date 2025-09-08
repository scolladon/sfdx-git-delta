import { Logger, LoggingService } from '../../../src/utils/LoggingService.js'

const debugMock = jest.fn()
const errorMock = jest.fn()
const fatalMock = jest.fn()
const infoMock = jest.fn()
const traceMock = jest.fn()
const warnMock = jest.fn()

jest.mock('@salesforce/core', () => ({
  Logger: {
    childFromRoot: jest.fn(() => ({
      debug: jest.fn((...args) => debugMock(...args)),
      error: jest.fn((...args) => errorMock(...args)),
      fatal: jest.fn((...args) => fatalMock(...args)),
      info: jest.fn((...args) => infoMock(...args)),
      trace: jest.fn((...args) => traceMock(...args)),
      warn: jest.fn((...args) => warnMock(...args)),
    })),
  },
}))

describe('LoggingService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;[debugMock, errorMock, fatalMock, infoMock, warnMock, traceMock].forEach(
      mock => mock.mockClear()
    )
  })

  describe('given a new instance', () => {
    it('should create a logger with the plugin name', () => {
      expect(Logger).toBeDefined()
    })

    describe('when called twice', () => {
      it('should return the same instance', () => {
        expect(new LoggingService()).toStrictEqual(Logger)
      })
    })
  })

  describe('given debug call', () => {
    it('should call core logger debug', () => {
      Logger.debug('test message', { key: 'value' })
      expect(debugMock).toHaveBeenCalledTimes(1)
      expect(debugMock).toHaveBeenCalledWith('test message', {
        key: 'value',
      })
    })
  })

  describe('given error call', () => {
    it('should call core logger error', () => {
      Logger.error('test message', { key: 'value' })
      expect(errorMock).toHaveBeenCalledTimes(1)
      expect(errorMock).toHaveBeenCalledWith('test message', {
        key: 'value',
      })
    })
  })

  describe('given fatal call', () => {
    it('should call core logger fatal', () => {
      Logger.fatal('test message', { key: 'value' })
      expect(fatalMock).toHaveBeenCalledTimes(1)
      expect(fatalMock).toHaveBeenCalledWith('test message', {
        key: 'value',
      })
    })
  })

  describe('given info call', () => {
    it('should call core logger info', () => {
      Logger.info('test message', { key: 'value' })
      expect(infoMock).toHaveBeenCalledTimes(1)
      expect(infoMock).toHaveBeenCalledWith('test message', {
        key: 'value',
      })
    })
  })

  describe('given trace call', () => {
    it('should call core logger trace', () => {
      Logger.trace('test message', { key: 'value' })
      expect(traceMock).toHaveBeenCalledTimes(1)
      expect(traceMock).toHaveBeenCalledWith('test message', {
        key: 'value',
      })
    })
  })

  describe('given warn call', () => {
    it('should call core logger warn', () => {
      Logger.warn('test message', { key: 'value' })
      expect(warnMock).toHaveBeenCalledTimes(1)
      expect(warnMock).toHaveBeenCalledWith('test message', {
        key: 'value',
      })
    })
  })
})
