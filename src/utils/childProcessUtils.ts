'use strict'
import {
  ChildProcessWithoutNullStreams,
  SpawnOptionsWithoutStdio,
  spawn,
} from 'child_process'
import { normalize, sep } from 'path'

export const EOLRegex: RegExp = /\r?\n/g

export const treatPathSep = (data: string) => data?.replace(/[/\\]+/g, sep)

export const sanitizePath = (data: string) => {
  if (data) {
    return normalize(treatPathSep(data))
  }
  return data
}

export const getSpawnContentByLine = async (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio = {}
): Promise<string[]> => {
  const stream = spawn(command, [...args], options)
  const handler = new LineStreamHandler()
  return handleStream(stream, handler) as Promise<string[]>
}

export const getSpawnContent = async (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio = {}
): Promise<Buffer> => {
  const stream = spawn(command, [...args], options)
  const handler = new BufferStreamHandler()
  return handleStream(stream, handler) as Promise<Buffer>
}

const handleStream = (
  stream: ChildProcessWithoutNullStreams,
  handler: StreamHandler
): Promise<Buffer | string[]> => {
  return new Promise((resolve, reject) => {
    stream.stdout.on('data', (data: Buffer) => handler.onData(data))

    stream.stderr.setEncoding('utf8')
    stream.stderr.on('data', (data: string) => handler.onError(data))

    stream.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(handler.getError()))
        return
      }

      const result = handler.getContent()
      resolve(result)
    })
  })
}

abstract class StreamHandler {
  protected readonly error: string[] = []
  // eslint-disable-next-line no-unused-vars
  public abstract onData(data: Buffer): void
  public onError(data: string) {
    this.error.push(data.toString())
  }
  public getError() {
    return this.error.join('')
  }
  public abstract getContent(): Buffer | string[]
}

class BufferStreamHandler extends StreamHandler {
  protected readonly content: Buffer[] = []
  public override onData(data: Buffer): void {
    this.content.push(data)
  }
  public override getContent(): Buffer {
    return Buffer.concat(this.content)
  }
}

class LineStreamHandler extends StreamHandler {
  protected readonly content: string[] = []
  protected chunk: string = ''
  public override onData(data: Buffer): void {
    this.chunk += data
    let eolIndex = this.chunk.search(EOLRegex)
    while (eolIndex >= 0) {
      this.content.push(this.chunk.slice(0, eolIndex))
      this.chunk = this.chunk.slice(eolIndex + 1)
      eolIndex = this.chunk.search(EOLRegex)
    }
  }

  public override getContent(): string[] {
    if (this.chunk.length > 0) {
      this.content.push(this.chunk)
    }

    return this.content
  }
}
