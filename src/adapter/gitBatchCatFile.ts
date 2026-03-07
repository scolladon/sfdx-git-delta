'use strict'
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'

import { getErrorMessage } from '../utils/errorUtils.js'
import { Logger, lazy } from '../utils/LoggingService.js'

type PendingRequest = {
  resolve: (buf: Buffer) => void
  reject: (err: Error) => void
}

export class GitBatchCatFile {
  protected process: ChildProcessWithoutNullStreams
  protected queue: PendingRequest[] = []
  protected buffer: Buffer = Buffer.alloc(0)
  protected pendingSize: number = -1

  constructor(cwd: string) {
    this.process = spawn('git', ['cat-file', '--batch'], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.process.stdout.on('data', (chunk: Buffer) => this._onData(chunk))
    this.process.stderr.on('data', (chunk: Buffer) => {
      Logger.debug(lazy`GitBatchCatFile stderr: ${() => chunk.toString()}`)
    })
    this.process.on('error', (err: Error) => {
      Logger.debug(
        lazy`GitBatchCatFile process error: ${() => getErrorMessage(err)}`
      )
    })
    this.process.on('close', (code: number | null) => {
      if (code !== 0 && this.queue.length > 0) {
        const error = new Error(`git cat-file exited with code ${code}`)
        for (const entry of this.queue) {
          entry.reject(error)
        }
        this.queue = []
      }
    })
  }

  async getContent(revision: string, path: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject })
      this.process.stdin.write(`${revision}:${path}\n`)
    })
  }

  protected _onData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk])
    this._processBuffer()
  }

  protected _processBuffer() {
    while (this.queue.length > 0) {
      if (this.pendingSize === -1) {
        const newlineIdx = this.buffer.indexOf(0x0a)
        if (newlineIdx === -1) return
        const header = this.buffer.subarray(0, newlineIdx).toString()
        this.buffer = this.buffer.subarray(newlineIdx + 1)
        if (header.endsWith('missing')) {
          this.queue.shift()!.reject(new Error(`Object not found: ${header}`))
          continue
        }
        const parts = header.split(' ')
        this.pendingSize = parseInt(parts[2], 10)
        if (isNaN(this.pendingSize)) {
          this.pendingSize = -1
          this.queue.shift()!.reject(new Error(`Invalid header: ${header}`))
          continue
        }
      }
      if (this.buffer.length < this.pendingSize + 1) return
      const content = Buffer.from(this.buffer.subarray(0, this.pendingSize))
      this.buffer = this.buffer.subarray(this.pendingSize + 1)
      this.pendingSize = -1
      this.queue.shift()!.resolve(content)
    }
  }

  close() {
    if (!this.process.killed) {
      this.process.stdin.end()
      this.process.kill()
    }
    for (const entry of this.queue) {
      entry.reject(new Error('GitBatchCatFile closed'))
    }
    this.queue = []
  }
}
