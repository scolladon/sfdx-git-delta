'use strict'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OutputWriteError } from '../../../../src/utils/errorUtils'
import {
  asOutputWrite,
  toOutputWriteError,
  writeStreamed,
} from '../../../../src/utils/streamedWrite'
import {
  failingOpenStream,
  failingWriteStream,
  sinkStream,
} from '../../../__utils__/outputStreams'

const { mockCreateWriteStream } = vi.hoisted(() => ({
  mockCreateWriteStream: vi.fn(),
}))

vi.mock('node:fs', async () => ({
  ...(await vi.importActual<typeof import('node:fs')>('node:fs')),
  createWriteStream: mockCreateWriteStream,
}))
vi.mock('../../../../src/utils/LoggingService')

const OUTPUT_PATH = 'out/file.xml'

describe('Given toOutputWriteError', () => {
  it('When given a path and an EISDIR cause, Then the message is the rendered output-write warning and path and cause are kept', () => {
    // Arrange
    const cause = new Error('EISDIR')

    // Act
    const result = toOutputWriteError('out/package/package.xml', cause)

    // Assert
    expect(result).toBeInstanceOf(OutputWriteError)
    expect(result.message).toBe(
      "Unable to write 'out/package/package.xml' in the output directory. Caused by: EISDIR"
    )
    expect(result.path).toBe('out/package/package.xml')
    expect(result.cause).toBe(cause)
  })

  it('When the path holds a control character, Then the message carries it escaped', () => {
    // Arrange
    const cause = new Error('EISDIR')

    // Act
    const result = toOutputWriteError('out/a\nb.xml', cause)

    // Assert
    expect(result.message).toContain('out/a\\u{a}b.xml')
  })
})

describe('Given asOutputWrite', () => {
  it('When the operation rejects, Then it rejects with an OutputWriteError naming the path and keeping the cause', async () => {
    // Arrange
    const cause = new Error('EACCES')

    // Act
    const act = asOutputWrite(OUTPUT_PATH, () => Promise.reject(cause))

    // Assert
    await expect(act).rejects.toBeInstanceOf(OutputWriteError)
    await expect(act).rejects.toMatchObject({ path: OUTPUT_PATH, cause })
  })

  it('When the operation resolves, Then its value is passed through', async () => {
    // Act
    const result = await asOutputWrite(OUTPUT_PATH, () => Promise.resolve(42))

    // Assert
    expect(result).toBe(42)
  })
})

const nextTurn = (): Promise<void> =>
  new Promise(resolve => setImmediate(resolve))

describe('Given writeStreamed', () => {
  beforeEach(() => {
    mockCreateWriteStream.mockReset()
  })

  it('When the producer writes and resolves, Then it resolves, the stream is ended and opened at the path', async () => {
    // Arrange
    const stream = sinkStream()
    mockCreateWriteStream.mockReturnValueOnce(stream)

    // Act
    await writeStreamed(OUTPUT_PATH, async out => {
      out.write('content')
    })

    // Assert
    expect(stream.writableEnded).toBe(true)
    expect(mockCreateWriteStream).toHaveBeenCalledWith(OUTPUT_PATH)
  })

  it('When the stream fails to open and the producer writes synchronously, Then it rejects with an OutputWriteError carrying the path and the open error', async () => {
    // Arrange
    mockCreateWriteStream.mockReturnValueOnce(failingOpenStream('EISDIR'))

    // Act
    const act = writeStreamed(OUTPUT_PATH, async out => {
      out.write('content')
    })

    // Assert
    await expect(act).rejects.toBeInstanceOf(OutputWriteError)
    await expect(act).rejects.toMatchObject({ path: OUTPUT_PATH })
    await expect(act).rejects.toHaveProperty('cause.code', 'EISDIR')
  })

  it('When the stream fails to open while the producer awaits I/O first, Then it rejects with an OutputWriteError and leaves no unhandled rejection', async () => {
    // Arrange
    mockCreateWriteStream.mockReturnValueOnce(failingOpenStream('EISDIR'))

    // Act
    const act = writeStreamed(OUTPUT_PATH, async out => {
      await nextTurn()
      await nextTurn()
      out.write('content')
    })

    // Assert
    await expect(act).rejects.toBeInstanceOf(OutputWriteError)
  })

  it('When a write fails after the producer resolved, Then it rejects with an OutputWriteError', async () => {
    // Arrange
    mockCreateWriteStream.mockReturnValueOnce(failingWriteStream('ENOSPC'))

    // Act
    const act = writeStreamed(OUTPUT_PATH, async out => {
      out.write('content')
    })

    // Assert
    await expect(act).rejects.toBeInstanceOf(OutputWriteError)
    await expect(act).rejects.toHaveProperty('cause.code', 'ENOSPC')
  })

  it('When the producer fails on the read side, Then it rejects with the producer error, not an OutputWriteError, and destroys the stream', async () => {
    // Arrange
    const stream = sinkStream()
    mockCreateWriteStream.mockReturnValueOnce(stream)
    const failingReadable = new Readable({
      read() {
        this.destroy(new Error('read side failure'))
      },
    })

    // Act
    const act = writeStreamed(OUTPUT_PATH, out =>
      pipeline(failingReadable, out, { end: false })
    )

    // Assert
    await expect(act).rejects.toThrow('read side failure')
    await expect(act).rejects.not.toBeInstanceOf(OutputWriteError)
    expect(stream.destroyed).toBe(true)
  })
})
