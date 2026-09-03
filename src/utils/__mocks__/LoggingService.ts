import { vi } from 'vitest'

const { lazy } = await vi.importActual<typeof import('../LoggingService.js')>(
  '../LoggingService.js'
)

const resolve = vi.fn((msg: unknown) => {
  if (typeof msg === 'function') (msg as () => void)()
})

// Annotated rather than inferred: the spy's inferred type reaches into
// vitest's internal declarations, which tsc cannot name portably from here.
type LogSink = (msg: unknown) => void

const Logger: Record<'debug' | 'warn' | 'info' | 'error' | 'trace', LogSink> = {
  debug: resolve,
  warn: resolve,
  info: vi.fn(),
  error: vi.fn(),
  trace: vi.fn(),
}

export { Logger, lazy }
