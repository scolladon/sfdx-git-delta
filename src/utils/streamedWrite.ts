'use strict'
import { createWriteStream } from 'node:fs'
import type { Writable } from 'node:stream'
import { finished } from 'node:stream/promises'

import { getErrorMessage, OutputWriteError } from './errorUtils.js'
import { MessageService } from './MessageService.js'
import { sanitizeForMessage } from './messageSanitizer.js'

const OUTPUT_WRITE_FAILED = 'warning.OutputWriteFailed'

export type StreamProducer = (out: Writable) => Promise<void>

export const toOutputWriteError = (
  path: string,
  cause: unknown
): OutputWriteError =>
  new OutputWriteError(
    new MessageService().getMessage(OUTPUT_WRITE_FAILED, [
      sanitizeForMessage(path),
      sanitizeForMessage(getErrorMessage(cause)),
    ]),
    path,
    cause
  )

export const asOutputWrite = <T>(
  path: string,
  op: () => Promise<T>
): Promise<T> =>
  op().catch((cause: unknown) => {
    throw toOutputWriteError(path, cause)
  })

const produceThenEnd = async (
  out: Writable,
  producer: StreamProducer
): Promise<void> => {
  await producer(out)
  out.end()
}

// finished() and the producer are awaited together: a finished() promise that is
// not awaited while the producer awaits I/O becomes an unhandled rejection.
export const writeStreamed = async (
  path: string,
  producer: StreamProducer
): Promise<void> => {
  const out = createWriteStream(path)
  const written = finished(out)
  try {
    await Promise.all([produceThenEnd(out, producer), written])
  } catch (error) {
    const writeFailure = out.errored
    out.destroy()
    throw writeFailure ? toOutputWriteError(path, writeFailure) : error
  }
}
