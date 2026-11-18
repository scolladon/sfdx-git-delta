import { Writable } from 'node:stream'

const fsError = (code: string): NodeJS.ErrnoException =>
  Object.assign(new Error(code), { code })

// Same observable state as an fs.WriteStream whose open failed: fs opens in
// _construct, so the stream is destroyed with the error one event-loop turn later.
export const failingOpenStream = (code: string): Writable =>
  new Writable({
    construct(callback) {
      setImmediate(() => callback(fsError(code)))
    },
    write(_chunk, _encoding, callback) {
      callback()
    },
  })

// Opens fine, then the first write fails on a later event-loop turn (ENOSPC shape).
export const failingWriteStream = (code: string): Writable =>
  new Writable({
    write(_chunk, _encoding, callback) {
      setImmediate(() => callback(fsError(code)))
    },
  })

// A sink whose finished() resolves after end(); an unconsumed PassThrough
// never ends its readable side, so finished() would never settle on it.
export const sinkStream = (): Writable =>
  new Writable({
    write(_chunk, _encoding, callback) {
      callback()
    },
  })
