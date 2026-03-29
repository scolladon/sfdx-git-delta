import { vi } from 'vitest'

const { lazy } = await vi.importActual<typeof import('../LoggingService.js')>(
  '../LoggingService.js'
)

const resolve = vi.fn((msg: unknown) => {
  if (typeof msg === 'function') (msg as () => void)()
})

const Logger = {
  debug: resolve,
  warn: resolve,
  info: vi.fn(),
  error: vi.fn(),
  trace: vi.fn(),
}

export { Logger, lazy }
