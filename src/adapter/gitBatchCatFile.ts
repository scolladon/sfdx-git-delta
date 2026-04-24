'use strict'
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'

import { getErrorMessage } from '../utils/errorUtils.js'
import { Logger, lazy } from '../utils/LoggingService.js'
import {
  EscalateToStreamingSignal,
  SIZE_THRESHOLD,
  type SpawnFn,
} from './gitBlobReader.js'

type PendingRequest = {
  oid: string
  path: string
  allowStreamingEscalation: boolean
  resolve: (buf: Buffer) => void
  reject: (err: unknown) => void
}

export type GitBatchCatFileOptions = {
  sizeThreshold?: number
  spawnFn?: SpawnFn
}

export class GitBatchCatFile {
  protected process: ChildProcessWithoutNullStreams
  protected queue: PendingRequest[] = []
  protected chunks: Buffer[] = []
  protected totalLength: number = 0
  protected pendingSize: number = -1
  private readonly sizeThreshold: number
  private readonly spawnFn: SpawnFn

  constructor(
    protected readonly cwd: string,
    options: GitBatchCatFileOptions = {}
  ) {
    this.sizeThreshold = options.sizeThreshold ?? SIZE_THRESHOLD
    this.spawnFn = options.spawnFn ?? (spawn as SpawnFn)
    this.process = this._spawnSubprocess()
  }

  async getContent(oid: string, path: string): Promise<Buffer> {
    return this._enqueue(oid, path, false)
  }

  /**
   * Like getContent, but rejects with EscalateToStreamingSignal when the
   * blob size (from the git cat-file header) is at or above SIZE_THRESHOLD.
   * The subprocess is then recycled so queued reads keep flowing.
   */
  async getContentOrEscalate(oid: string, path: string): Promise<Buffer> {
    return this._enqueue(oid, path, true)
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

  private _enqueue(
    oid: string,
    path: string,
    allowStreamingEscalation: boolean
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        oid,
        path,
        allowStreamingEscalation,
        resolve,
        reject,
      })
      this.process.stdin.write(`${oid}:${path}\n`)
    })
  }

  protected _onData(chunk: Buffer) {
    this.chunks.push(chunk)
    this.totalLength += chunk.length
    this._processBuffer()
  }

  protected _materializeBuffer(): Buffer {
    if (this.chunks.length === 1) return this.chunks[0]
    const merged = Buffer.concat(this.chunks, this.totalLength)
    this.chunks = [merged]
    return merged
  }

  protected _advance(buffer: Buffer, consumed: number): Buffer {
    const rest = buffer.subarray(consumed)
    if (rest.length === 0) {
      this.chunks = []
      this.totalLength = 0
    } else {
      this.chunks = [rest]
      this.totalLength = rest.length
    }
    return rest
  }

  protected _processBuffer() {
    let buffer = this._materializeBuffer()
    while (this.queue.length > 0) {
      if (this.pendingSize === -1) {
        const outcome = this._parseHeader(buffer)
        if (outcome === 'need-more-data') return
        buffer = outcome.remaining
        if (outcome.action === 'reject' || outcome.action === 'escalated') {
          continue
        }
      }
      if (buffer.length < this.pendingSize + 1) return
      const content = Buffer.from(buffer.subarray(0, this.pendingSize))
      buffer = this._advance(buffer, this.pendingSize + 1)
      this.pendingSize = -1
      this.queue.shift()!.resolve(content)
    }
  }

  private _parseHeader(
    buffer: Buffer
  ):
    | 'need-more-data'
    | { remaining: Buffer; action: 'reject' | 'escalated' | 'await-body' } {
    const newlineIdx = buffer.indexOf(0x0a)
    if (newlineIdx === -1) return 'need-more-data'
    const header = buffer.subarray(0, newlineIdx).toString()
    const remaining = this._advance(buffer, newlineIdx + 1)
    if (header.endsWith('missing')) {
      this.queue.shift()!.reject(new Error(`Object not found: ${header}`))
      return { remaining, action: 'reject' }
    }
    const parts = header.split(' ')
    const parsedSize = Number.parseInt(parts[2], 10)
    if (Number.isNaN(parsedSize)) {
      this.queue.shift()!.reject(new Error(`Invalid header: ${header}`))
      return { remaining, action: 'reject' }
    }
    const head = this.queue[0]
    if (head.allowStreamingEscalation && parsedSize >= this.sizeThreshold) {
      this._escalateHead(parsedSize)
      return { remaining: Buffer.alloc(0), action: 'escalated' }
    }
    this.pendingSize = parsedSize
    return { remaining, action: 'await-body' }
  }

  private _escalateHead(size: number): void {
    const escalated = this.queue.shift()!
    escalated.reject(
      new EscalateToStreamingSignal(size, {
        oid: escalated.oid,
        path: escalated.path,
      })
    )
    const pending = this.queue.splice(0)
    this._recycleSubprocess()
    for (const request of pending) {
      this.queue.push(request)
      this.process.stdin.write(`${request.oid}:${request.path}\n`)
    }
  }

  private _recycleSubprocess(): void {
    const stale = this.process
    if (!stale.killed) {
      try {
        stale.stdin.end()
      } catch {
        // ignore broken pipe while recycling
      }
      stale.kill()
    }
    this.chunks = []
    this.totalLength = 0
    this.pendingSize = -1
    this.process = this._spawnSubprocess()
  }

  private _spawnSubprocess(): ChildProcessWithoutNullStreams {
    const child = this.spawnFn('git', ['cat-file', '--batch'], {
      cwd: this.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    child.stdout.on('data', (chunk: Buffer) => this._onData(chunk))
    child.stderr.on('data', (chunk: Buffer) => {
      Logger.debug(lazy`GitBatchCatFile stderr: ${() => chunk.toString()}`)
    })
    child.on('error', (err: Error) => {
      Logger.debug(
        lazy`GitBatchCatFile process error: ${() => getErrorMessage(err)}`
      )
    })
    child.on('close', (code: number | null) => {
      if (child !== this.process) return
      if (code !== 0 && this.queue.length > 0) {
        const error = new Error(`git cat-file exited with code ${code}`)
        for (const entry of this.queue) {
          entry.reject(error)
        }
        this.queue = []
      }
    })
    return child
  }
}
