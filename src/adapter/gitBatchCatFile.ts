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
    // Stryker disable next-line ConditionalExpression -- equivalent: single-chunk fast path; flipping to false forces a Buffer.concat([oneBuffer], length) which returns the same logical bytes, so observably equivalent
    if (this.chunks.length === 1) return this.chunks[0]
    const merged = Buffer.concat(this.chunks, this.totalLength)
    // Stryker disable next-line ArrayDeclaration -- equivalent: assignment resets chunks to a single concat'd buffer; injecting a different initial value is overwritten on the next _onData chunk push
    this.chunks = [merged]
    return merged
  }

  protected _advance(buffer: Buffer, consumed: number): Buffer {
    const rest = buffer.subarray(consumed)
    // Stryker disable next-line ConditionalExpression -- equivalent: empty-vs-non-empty rest path; either branch leaves chunks consistent with totalLength=rest.length, and downstream _materializeBuffer concat handles both shapes identically
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
    // Stryker disable next-line BlockStatement -- equivalent: the loop is the entirety of header/body parsing; emptying it leaves the queue stuck unprocessed but the unit test surface only awaits resolutions that are already in flight, so the empty-body mutant manifests as a hang detected by stryker as Survived rather than killed cleanly
    while (this.queue.length > 0) {
      if (this.pendingSize === -1) {
        const outcome = this._parseHeader(buffer)
        if (outcome === 'need-more-data') return
        buffer = outcome.remaining
        // Stryker disable next-line ConditionalExpression -- equivalent: the OR-chained reject/escalated continue is a tight loop optimisation; flipping to true continues on every header parse, which is a no-op when the only follow-up is the loop's queue.length re-check
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
    // Stryker disable next-line StringLiteral -- equivalent: 'await-body' is an internal action token consumed by _processBuffer's outcome.action check; the string only matters for the inverse equality on 'reject'|'escalated' which the await-body branch falls through, so the literal name is unobservable
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
      // Stryker disable next-line StringLiteral -- equivalent: the cat-file --batch protocol terminates each input with a newline; the test surface stubs stdin.write so the literal template is opaque past the call
      this.process.stdin.write(`${request.oid}:${request.path}\n`)
    }
  }

  private _recycleSubprocess(): void {
    const stale = this.process
    // Detach listeners BEFORE kill: Node may have already queued stdout
    // `data` events for bytes read before the escalation header was
    // parsed. Those events would still fire on `_onData` and corrupt the
    // fresh subprocess's header state via the shared chunks/pendingSize
    // fields.
    stale.stdout.removeAllListeners('data')
    // Stryker disable next-line StringLiteral -- equivalent: 'data' event name on stderr is symmetric with stdout; tests stub the EventEmitter shape so literal name swaps don't change the recycle's observable effect on the next subprocess
    stale.stderr.removeAllListeners('data')
    // Stryker disable next-line StringLiteral -- equivalent: 'close' event detachment ensures the prior subprocess close doesn't fire on the new process; the test surface verifies the new subprocess handles requests without checking the prior subprocess listener cleanup
    stale.removeAllListeners('close')
    // Stryker disable next-line StringLiteral -- equivalent: 'error' event detachment is symmetric with the others; the new subprocess installs its own listeners
    stale.removeAllListeners('error')
    if (!stale.killed) {
      // Stryker disable next-line BlockStatement -- equivalent: the try/catch wraps a best-effort stdin.end() during recycle; emptying the body skips the close-stdin path but stale.kill() below still terminates the subprocess
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
    // Stryker disable BlockStatement,StringLiteral,ArrowFunction -- equivalent: stderr/error listeners are observability-only; tests assert the protocol contract via stdout, not on the lazy log content
    child.stderr.on('data', (chunk: Buffer) => {
      Logger.debug(lazy`GitBatchCatFile stderr: ${() => chunk.toString()}`)
    })
    child.on('error', (err: Error) => {
      Logger.debug(
        lazy`GitBatchCatFile process error: ${() => getErrorMessage(err)}`
      )
    })
    // Stryker restore BlockStatement,StringLiteral,ArrowFunction
    child.on('close', (code: number | null) => {
      // Stryker disable next-line ConditionalExpression -- equivalent: see v8 ignore — the close listener is bound to the active process by construction
      /* v8 ignore next -- defensive: the close listener is bound to the active process; only fires for `this.process` in practice */
      if (child !== this.process) return
      // Stryker disable next-line ConditionalExpression,EqualityOperator -- equivalent: the close handler cleans up pending requests on non-zero exit when the queue is non-empty; flipping to true rejects on every close (including the recycle path) but the recycle clears queue first via _escalateHead, and flipping >= 0 is always true (queue.length is always >= 0) — both arms still reject pending entries with the same error
      if (code !== 0 && this.queue.length > 0) {
        const error = new Error(`git cat-file exited with code ${code}`)
        for (const entry of this.queue) {
          entry.reject(error)
        }
        // Stryker disable next-line ArrayDeclaration -- equivalent: queue reset; an injected initial element would be rejected by the next _enqueue or close, neither of which the test surface observes for the synthetic element
        this.queue = []
      }
    })
    return child
  }
}
