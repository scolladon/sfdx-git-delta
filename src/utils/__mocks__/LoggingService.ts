const { lazy } = jest.requireActual<typeof import('../LoggingService.js')>(
  '../LoggingService.js'
)

const resolve = jest.fn((msg: unknown) => {
  if (typeof msg === 'function') (msg as () => void)()
})

const Logger = {
  debug: resolve,
  warn: resolve,
  info: jest.fn(),
  error: jest.fn(),
  trace: jest.fn(),
}

export { lazy, Logger }
