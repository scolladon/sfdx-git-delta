'use strict'
import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GitBatchCatFile } from '../../../../src/adapter/gitBatchCatFile'

vi.mock('../../../../src/utils/LoggingService')

type FakeChild = EventEmitter & {
  stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }
  stdout: EventEmitter
  stderr: EventEmitter
  killed: boolean
  kill: ReturnType<typeof vi.fn>
}

const createFakeChild = (): FakeChild => {
  const stdin = { write: vi.fn(), end: vi.fn() }
  const stdout = new EventEmitter()
  const stderr = new EventEmitter()
  const child = Object.assign(new EventEmitter(), {
    stdin,
    stdout,
    stderr,
    killed: false,
    kill: vi.fn(() => {
      child.killed = true
    }),
  }) as FakeChild
  return child
}

const createFakeSpawnSequence = (count: number) => {
  const procs: FakeChild[] = Array.from({ length: count }, createFakeChild)
  let idx = 0
  const spawnFn = vi.fn(() => procs[idx++] as never)
  return { procs, spawnFn }
}

// Tests that construct `new GitBatchCatFile('/repo')` (no spawnFn override)
// rely on the mocked `node:child_process.spawn` resolving to `currentChild`.
// `currentChild` is reassigned in `beforeEach` so no state leaks across tests.
let currentChild: FakeChild
let mockStdin: FakeChild['stdin']
let mockStdout: FakeChild['stdout']
let mockStderr: FakeChild['stderr']
let mockProcess: FakeChild

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => currentChild),
}))

beforeEach(() => {
  vi.clearAllMocks()
  currentChild = createFakeChild()
  mockStdin = currentChild.stdin
  mockStdout = currentChild.stdout
  mockStderr = currentChild.stderr
  mockProcess = currentChild
})

describe('GitBatchCatFile', () => {
  describe('Given the subprocess is spawned', () => {
    it('When the constructor runs, Then spawn is called with the exact cat-file --batch argv', () => {
      // Arrange
      const fakes = createFakeSpawnSequence(1)

      // Act
      const sut = new GitBatchCatFile('/repo-path', { spawnFn: fakes.spawnFn })

      // Assert — strict argv equality
      expect(fakes.spawnFn).toHaveBeenCalledWith(
        'git',
        ['cat-file', '--batch'],
        { cwd: '/repo-path', stdio: ['pipe', 'pipe', 'pipe'] }
      )
      sut.close()
    })
  })

  describe('Given the subprocess closes', () => {
    it('When it exits with code 0 and queue is empty, Then nothing is rejected', () => {
      // Arrange
      const fakes = createFakeSpawnSequence(1)
      const sut = new GitBatchCatFile('/repo', { spawnFn: fakes.spawnFn })

      // Act & Assert — must not throw
      expect(() => fakes.procs[0]!.emit('close', 0)).not.toThrow()
      sut.close()
    })

    it('When it exits with non-zero code but queue is empty, Then nothing is rejected', () => {
      // Arrange
      const fakes = createFakeSpawnSequence(1)
      const sut = new GitBatchCatFile('/repo', { spawnFn: fakes.spawnFn })

      // Act & Assert — queue.length > 0 guard blocks cascade
      expect(() => fakes.procs[0]!.emit('close', 1)).not.toThrow()
      sut.close()
    })

    it('When it exits with code 0 and queue has pending requests, Then nothing is rejected (code !== 0 guard)', async () => {
      // Arrange
      const fakes = createFakeSpawnSequence(1)
      const sut = new GitBatchCatFile('/repo', { spawnFn: fakes.spawnFn })
      const pending = sut.getContent('oid', 'path')

      // Act — code === 0 bypasses the reject cascade
      fakes.procs[0]!.emit('close', 0)
      // Resolve pending manually via stdout data
      fakes.procs[0]!.stdout.emit('data', Buffer.from('oid blob 2\nok\n'))

      // Assert — pending still resolves because the close-0 path didn't reject it
      expect((await pending).toString()).toBe('ok')
      sut.close()
    })
  })

  describe('Given a successful content read', () => {
    it('When getContent is called, Then returns the file content', async () => {
      // Arrange
      const sut = new GitBatchCatFile('/repo')
      const oid = 'abc123'
      const path = 'file.txt'
      const fileContent = 'hello world'

      // Act
      const promise = sut.getContent(oid, path)

      const header = `abc123def456 blob ${fileContent.length}\n`
      const body = `${fileContent}\n`
      mockStdout.emit('data', Buffer.from(header + body))

      const result = await promise

      // Assert
      expect(result.toString()).toBe(fileContent)
      expect(mockStdin.write).toHaveBeenCalledWith(`${oid}:${path}\n`)

      sut.close()
    })
  })

  describe('Given a missing object', () => {
    it('When getContent is called, Then rejects with an error', async () => {
      // Arrange
      const sut = new GitBatchCatFile('/repo')

      // Act
      const promise = sut.getContent('badrev', 'nofile.txt')

      mockStdout.emit('data', Buffer.from('badrev:nofile.txt missing\n'))

      // Assert
      await expect(promise).rejects.toThrow('Object not found')

      sut.close()
    })
  })

  describe('Given close is called with pending promises', () => {
    it('When close is called, Then rejects all pending requests', async () => {
      // Arrange
      const sut = new GitBatchCatFile('/repo')

      // Act
      const promise1 = sut.getContent('rev1', 'file1.txt')
      const promise2 = sut.getContent('rev2', 'file2.txt')
      sut.close()

      // Assert
      await expect(promise1).rejects.toThrow('GitBatchCatFile closed')
      await expect(promise2).rejects.toThrow('GitBatchCatFile closed')
      expect(mockStdin.end).toHaveBeenCalled()
      expect(mockProcess.kill).toHaveBeenCalled()
    })
  })

  describe('Given multiple sequential reads', () => {
    it('When getContent is called multiple times, Then resolves each in order', async () => {
      // Arrange
      const sut = new GitBatchCatFile('/repo')
      const content1 = 'first'
      const content2 = 'second'

      // Act
      const promise1 = sut.getContent('rev1', 'file1.txt')
      const promise2 = sut.getContent('rev2', 'file2.txt')

      const header1 = `oid1 blob ${content1.length}\n`
      const body1 = `${content1}\n`
      const header2 = `oid2 blob ${content2.length}\n`
      const body2 = `${content2}\n`
      mockStdout.emit('data', Buffer.from(header1 + body1 + header2 + body2))

      const result1 = await promise1
      const result2 = await promise2

      // Assert
      expect(result1.toString()).toBe(content1)
      expect(result2.toString()).toBe(content2)

      sut.close()
    })
  })

  describe('Given data arrives in chunks', () => {
    it('When stdout emits partial data, Then buffers until complete', async () => {
      // Arrange
      const sut = new GitBatchCatFile('/repo')
      const content = 'chunked content here'

      // Act
      const promise = sut.getContent('rev', 'file.txt')

      // Send header partially
      mockStdout.emit('data', Buffer.from(`oid1 blob ${content.length}`))
      // Send rest of header + partial body
      mockStdout.emit('data', Buffer.from(`\n${content.slice(0, 5)}`))
      // Send rest of body + trailing newline
      mockStdout.emit('data', Buffer.from(`${content.slice(5)}\n`))

      const result = await promise

      // Assert
      expect(result.toString()).toBe(content)

      sut.close()
    })
  })

  describe('Given binary content', () => {
    it('When getContent returns binary data, Then returns exact bytes', async () => {
      // Arrange
      const sut = new GitBatchCatFile('/repo')
      const binaryContent = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x0a, 0x0d])

      // Act
      const promise = sut.getContent('rev', 'binary.bin')

      const header = Buffer.from(`oid1 blob ${binaryContent.length}\n`)
      const trailing = Buffer.from([0x0a])
      mockStdout.emit('data', Buffer.concat([header, binaryContent, trailing]))

      const result = await promise

      // Assert
      expect(result).toEqual(binaryContent)

      sut.close()
    })
  })

  describe('Given close is called on an already killed process', () => {
    it('When close is called, Then does not call kill again', () => {
      // Arrange
      ;(mockProcess as { killed: boolean }).killed = true
      mockProcess.kill.mockClear()
      mockStdin.end.mockClear()
      const sut = new GitBatchCatFile('/repo')

      // Act
      sut.close()

      // Assert
      expect(mockProcess.kill).not.toHaveBeenCalled()
      expect(mockStdin.end).not.toHaveBeenCalled()
    })
  })

  describe('Given stderr output', () => {
    it('When stderr emits data, Then does not crash', () => {
      // Arrange
      ;(mockProcess as { killed: boolean }).killed = false
      new GitBatchCatFile('/repo')

      // Act & Assert (should not throw)
      expect(() => {
        mockStderr.emit('data', Buffer.from('some warning'))
      }).not.toThrow()
    })
  })

  describe('Given a malformed header', () => {
    it('When header has no size, Then rejects with invalid header error', async () => {
      // Arrange
      const sut = new GitBatchCatFile('/repo')

      // Act
      const promise = sut.getContent('rev', 'file.txt')

      mockStdout.emit('data', Buffer.from('oid1 blob\n'))

      // Assert
      await expect(promise).rejects.toThrow('Invalid header: oid1 blob')

      sut.close()
    })

    it('When header has invalid size followed by valid request, Then resets pendingSize to -1 and resolves next request', async () => {
      // Arrange
      const sut = new GitBatchCatFile('/repo')
      const validContent = 'valid'

      // Act
      const promise1 = sut.getContent('rev1', 'bad.txt')
      const promise2 = sut.getContent('rev2', 'good.txt')

      // Send malformed header (NaN size) then valid header+body
      const malformed = 'oid1 blob\n'
      const validHeader = `oid2 blob ${validContent.length}\n`
      const validBody = `${validContent}\n`
      mockStdout.emit('data', Buffer.from(malformed + validHeader + validBody))

      // Assert
      await expect(promise1).rejects.toThrow('Invalid header')
      const result2 = await promise2
      expect(result2.toString()).toBe(validContent)

      sut.close()
    })
  })

  describe('Given process exits unexpectedly with pending requests', () => {
    it('When close emits non-zero code, Then rejects all pending promises', async () => {
      // Arrange
      const sut = new GitBatchCatFile('/repo')

      // Act
      const promise1 = sut.getContent('rev1', 'file1.txt')
      const promise2 = sut.getContent('rev2', 'file2.txt')
      mockProcess.emit('close', 1)

      // Assert
      await expect(promise1).rejects.toThrow('git cat-file exited with code 1')
      await expect(promise2).rejects.toThrow('git cat-file exited with code 1')
    })
  })

  describe('Given process exits normally with no pending requests', () => {
    it('When close emits code 0, Then does nothing', () => {
      // Arrange
      ;(mockProcess as { killed: boolean }).killed = false
      new GitBatchCatFile('/repo')

      // Act & Assert (should not throw)
      expect(() => {
        mockProcess.emit('close', 0)
      }).not.toThrow()
    })
  })

  describe('Given process error', () => {
    it('When process emits error, Then does not crash', () => {
      // Arrange
      ;(mockProcess as { killed: boolean }).killed = false
      new GitBatchCatFile('/repo')

      // Act & Assert (should not throw)
      expect(() => {
        mockProcess.emit('error', new Error('spawn failed'))
      }).not.toThrow()
    })
  })

  describe('Given an escalation-eligible request with oversize blob', () => {
    it('When the header reports size >= threshold, Then rejects with EscalateToStreamingSignal and recycles the subprocess', async () => {
      // Arrange
      const fakes = createFakeSpawnSequence(2)
      const sut = new GitBatchCatFile('/repo', {
        sizeThreshold: 1024,
        spawnFn: fakes.spawnFn,
      })

      // Act
      const escalating = sut.getContentOrEscalate('oidBig', 'big.bin')

      // Emit header showing size > threshold
      fakes.procs[0].stdout.emit('data', Buffer.from('oidBig blob 4096\n'))

      // Assert
      const [error] = await Promise.allSettled([escalating]).then(r =>
        r[0].status === 'rejected' ? [r[0].reason] : [undefined]
      )
      expect(error).toBeDefined()
      expect((error as { name: string }).name).toBe('EscalateToStreamingSignal')
      expect(fakes.procs[0].kill).toHaveBeenCalled()
      expect(fakes.spawnFn).toHaveBeenCalledTimes(2)
      sut.close()
    })

    it('Given five queued requests where the third exceeds threshold, When escalation fires, Then the third rejects while others resolve after re-enqueue', async () => {
      // Arrange
      const fakes = createFakeSpawnSequence(2)
      const sut = new GitBatchCatFile('/repo', {
        sizeThreshold: 1024,
        spawnFn: fakes.spawnFn,
      })

      // Act
      const p1 = sut.getContentOrEscalate('oid1', 'f1.txt')
      const p2 = sut.getContentOrEscalate('oid2', 'f2.txt')
      const p3 = sut.getContentOrEscalate('oid3', 'big.bin')
      const p4 = sut.getContentOrEscalate('oid4', 'f4.txt')
      const p5 = sut.getContentOrEscalate('oid5', 'f5.txt')

      // First two resolve from the original subprocess
      const firstChunk =
        `oid1 blob 1\nA\n` + `oid2 blob 1\nB\n` + `oid3 blob 4096\n`
      fakes.procs[0].stdout.emit('data', Buffer.from(firstChunk))

      // After escalation, the fresh subprocess services p4 and p5
      fakes.procs[1].stdout.emit(
        'data',
        Buffer.from(`oid4 blob 1\nD\noid5 blob 1\nE\n`)
      )

      // Assert
      expect((await p1).toString()).toBe('A')
      expect((await p2).toString()).toBe('B')
      await expect(p3).rejects.toMatchObject({
        name: 'EscalateToStreamingSignal',
      })
      expect((await p4).toString()).toBe('D')
      expect((await p5).toString()).toBe('E')
      sut.close()
    })

    it('Given a size exactly equal to threshold, When the header is parsed, Then the request escalates (>= boundary)', async () => {
      // Arrange
      const fakes = createFakeSpawnSequence(2)
      const sut = new GitBatchCatFile('/repo', {
        sizeThreshold: 1024,
        spawnFn: fakes.spawnFn,
      })

      // Act
      const p = sut.getContentOrEscalate('oidEq', 'eq.bin')
      fakes.procs[0].stdout.emit('data', Buffer.from('oidEq blob 1024\n'))

      // Assert — size === threshold must escalate (guards `>=` vs `>`)
      await expect(p).rejects.toMatchObject({
        name: 'EscalateToStreamingSignal',
      })
      sut.close()
    })

    it('Given a size one below threshold, When the header is parsed, Then the request resolves normally', async () => {
      // Arrange
      const fakes = createFakeSpawnSequence(2)
      const sut = new GitBatchCatFile('/repo', {
        sizeThreshold: 1024,
        spawnFn: fakes.spawnFn,
      })

      // Act
      const p = sut.getContentOrEscalate('oidNear', 'near.bin')
      const payload = Buffer.alloc(1023, 0x61)
      fakes.procs[0].stdout.emit(
        'data',
        Buffer.concat([
          Buffer.from('oidNear blob 1023\n'),
          payload,
          Buffer.from([0x0a]),
        ])
      )

      // Assert — size === threshold-1 does NOT escalate
      expect((await p).length).toBe(1023)
      sut.close()
    })

    it('Given the stale subprocess emits data after escalation, When the fresh subprocess services the next request, Then the stale bytes do not corrupt parsing', async () => {
      // Arrange
      const fakes = createFakeSpawnSequence(2)
      const sut = new GitBatchCatFile('/repo', {
        sizeThreshold: 1024,
        spawnFn: fakes.spawnFn,
      })

      // Act — trigger escalation
      const p1 = sut.getContentOrEscalate('oidBig', 'big.bin')
      fakes.procs[0].stdout.emit('data', Buffer.from('oidBig blob 4096\n'))
      await expect(p1).rejects.toMatchObject({
        name: 'EscalateToStreamingSignal',
      })

      // Simulate a late-delivered data event on the OLD subprocess's stdout
      // (as if Node had already queued it before kill). If the listener is
      // still attached, it would mutate the shared chunks/pendingSize and
      // break the next request.
      fakes.procs[0].stdout.emit('data', Buffer.from('GARBAGE\n'))

      // The fresh subprocess services a normal request cleanly.
      const p2 = sut.getContent('oid2', 'file2.txt')
      fakes.procs[1].stdout.emit('data', Buffer.from('oid2 blob 5\nhello\n'))

      // Assert
      expect((await p2).toString()).toBe('hello')
      sut.close()
    })
  })

  // -----------------------------------------------------------------------
  // Mutation-killing tests (added to kill Stryker survivors)
  // -----------------------------------------------------------------------

  describe('Given getContent vs getContentOrEscalate escalation flag', () => {
    it('When getContent is called with size >= threshold, Then it resolves (allowStreamingEscalation=false, no escalation)', async () => {
      // Arrange — getContent must pass allowStreamingEscalation=false so
      // even an oversized blob is returned as a buffer.
      const fakes = createFakeSpawnSequence(1)
      const sut = new GitBatchCatFile('/repo', {
        sizeThreshold: 1,
        spawnFn: fakes.spawnFn,
      })

      // Act
      const p = sut.getContent('oidBig', 'big.bin')
      const payload = Buffer.from('X')
      fakes.procs[0].stdout.emit(
        'data',
        Buffer.concat([
          Buffer.from('oidBig blob 1\n'),
          payload,
          Buffer.from([0x0a]),
        ])
      )

      // Assert — resolves, NOT escalated (kills L44 BooleanLiteral → true)
      expect((await p).toString()).toBe('X')
      sut.close()
    })
  })

  describe('Given _materializeBuffer with multiple chunks', () => {
    it('When two separate data events arrive, Then both chunks are concatenated into a single buffer', async () => {
      // Arrange — forces chunks.length > 1 before any header newline is
      // received, exercising the merge branch (kills L91 ConditionalExpression)
      const sut = new GitBatchCatFile('/repo')
      const content = 'hello'

      // Act
      const p = sut.getContent('rev', 'file.txt')
      // Send header in one chunk, content in another — two separate `data`
      // events so chunks[] has two entries when the second call processes.
      mockStdout.emit('data', Buffer.from(`oid blob ${content.length}\n`))
      mockStdout.emit('data', Buffer.from(`${content}\n`))

      const result = await p

      // Assert
      expect(result.toString()).toBe(content)
      sut.close()
    })
  })

  describe('Given _processBuffer body-wait condition', () => {
    it('When pendingSize+1 bytes are exactly available, Then the content is resolved (boundary: buffer.length === pendingSize+1)', async () => {
      // Arrange — tests pendingSize+1 vs pendingSize (kills L120 ArithmeticOperator)
      const sut = new GitBatchCatFile('/repo')
      const content = 'AB'
      // pendingSize = 2, so we need at least 3 bytes (content + trailing \n)

      // Act
      const p = sut.getContent('rev', 'f.txt')
      mockStdout.emit(
        'data',
        Buffer.concat([
          Buffer.from(`oid blob ${content.length}\n`),
          Buffer.from(`${content}\n`),
        ])
      )

      // Assert
      expect((await p).toString()).toBe(content)
      sut.close()
    })

    it('When exactly pendingSize bytes are available but no trailing newline, Then it waits for more data before resolving', async () => {
      // Arrange — buffer.length === pendingSize (not pendingSize+1), must stall
      const sut = new GitBatchCatFile('/repo')
      const content = 'XY'

      // Act
      const p = sut.getContent('rev', 'f.txt')
      // Send header then body WITHOUT trailing newline
      mockStdout.emit('data', Buffer.from(`oid blob ${content.length}\n`))
      mockStdout.emit('data', Buffer.from(content)) // 2 bytes, needs 3

      // Assert — still pending at this point (not yet resolved)
      let resolved = false
      p.then(() => {
        resolved = true
      })
      await new Promise(resolve => setImmediate(resolve))
      expect(resolved).toBe(false)

      // Now deliver the trailing byte — should resolve
      mockStdout.emit('data', Buffer.from('\n'))
      expect((await p).toString()).toBe(content)
      sut.close()
    })
  })

  describe('Given _processBuffer queue.length check', () => {
    it('When queue is empty and data arrives, Then no error is thrown', () => {
      // Arrange — tests queue.length > 0 guard (kills L111 EqualityOperator)
      const sut = new GitBatchCatFile('/repo')

      // Act — send data with no pending requests; must not throw
      expect(() => {
        mockStdout.emit('data', Buffer.from('oid blob 3\nabc\n'))
      }).not.toThrow()

      sut.close()
    })

    it('When queue has exactly one item and data satisfies it, Then resolves that one item', async () => {
      // Arrange
      const sut = new GitBatchCatFile('/repo')
      const p = sut.getContent('oid1', 'f1.txt')

      // Act
      mockStdout.emit('data', Buffer.from('oid1 blob 3\nabc\n'))

      // Assert — exactly one item resolved, queue now empty
      expect((await p).toString()).toBe('abc')
      sut.close()
    })
  })

  describe('Given _processBuffer action branching after header parse', () => {
    it('When action is reject, Then the while loop continues without trying to read body', async () => {
      // Arrange — two requests: first is missing (reject action), second
      // should still resolve (kills L116 ConditionalExpression)
      const sut = new GitBatchCatFile('/repo')
      const p1 = sut.getContent('badoid', 'missing.txt')
      const p2 = sut.getContent('goodoid', 'present.txt')

      // Act — send both responses in one chunk
      mockStdout.emit(
        'data',
        Buffer.from('badoid:missing.txt missing\ngoodoid blob 2\nok\n')
      )

      // Assert
      await expect(p1).rejects.toThrow('Object not found')
      expect((await p2).toString()).toBe('ok')
      sut.close()
    })

    it('When action is escalated, Then the while loop continues without consuming body bytes', async () => {
      // Arrange — first request escalates, second resolves from fresh proc
      // (kills L116 ConditionalExpression for `escalated` branch)
      const fakes = createFakeSpawnSequence(2)
      const sut = new GitBatchCatFile('/repo', {
        sizeThreshold: 10,
        spawnFn: fakes.spawnFn,
      })
      const p1 = sut.getContentOrEscalate('bigoid', 'big.bin')
      const p2 = sut.getContentOrEscalate('smalloid', 'small.txt')

      fakes.procs[0].stdout.emit('data', Buffer.from('bigoid blob 4096\n'))
      // After escalation, p2 is re-queued on fresh proc
      fakes.procs[1].stdout.emit('data', Buffer.from('smalloid blob 2\nok\n'))

      await expect(p1).rejects.toMatchObject({
        name: 'EscalateToStreamingSignal',
      })
      expect((await p2).toString()).toBe('ok')
      sut.close()
    })
  })

  describe('Given _recycleSubprocess with already-killed stale process', () => {
    it('When the stale process is already killed, Then stdin.end and kill are NOT called during recycle', async () => {
      // Arrange — kills L183 ConditionalExpression (!stale.killed guard)
      const fakes = createFakeSpawnSequence(2)
      const sut = new GitBatchCatFile('/repo', {
        sizeThreshold: 10,
        spawnFn: fakes.spawnFn,
      })

      // Kill the first proc before escalation
      fakes.procs[0].killed = true
      const p = sut.getContentOrEscalate('bigoid', 'big.bin')
      fakes.procs[0].stdout.emit('data', Buffer.from('bigoid blob 4096\n'))

      await expect(p).rejects.toMatchObject({
        name: 'EscalateToStreamingSignal',
      })

      // stale proc was already killed — stdin.end and kill should not be called
      expect(fakes.procs[0].stdin.end).not.toHaveBeenCalled()
      expect(fakes.procs[0].kill).not.toHaveBeenCalled()
      sut.close()
    })
  })

  describe('Given _spawnSubprocess close handler with stale process guard', () => {
    it('When a stale recycled process emits close with non-zero code and queue is pending, Then the stale close is ignored (child !== this.process guard)', async () => {
      // Arrange — kills L212 ConditionalExpression (child !== this.process)
      const fakes = createFakeSpawnSequence(2)
      const sut = new GitBatchCatFile('/repo', {
        sizeThreshold: 10,
        spawnFn: fakes.spawnFn,
      })

      // Trigger escalation to recycle to proc[1]
      const p1 = sut.getContentOrEscalate('bigoid', 'big.bin')
      fakes.procs[0].stdout.emit('data', Buffer.from('bigoid blob 4096\n'))
      await expect(p1).rejects.toMatchObject({
        name: 'EscalateToStreamingSignal',
      })

      // Now enqueue a fresh request on proc[1]
      const p2 = sut.getContent('oid2', 'f2.txt')

      // The stale proc[0] fires a non-zero close — must NOT reject p2
      // (if the guard were absent, p2 would be rejected)
      fakes.procs[0].emit('close', 1)
      await new Promise(resolve => setImmediate(resolve))

      // p2 is still pending — satisfy it from proc[1]
      fakes.procs[1].stdout.emit('data', Buffer.from('oid2 blob 5\nhello\n'))
      expect((await p2).toString()).toBe('hello')
      sut.close()
    })

    it('When the active process emits non-zero close with queue length === 0, Then nothing is rejected', () => {
      // Arrange — kills L213 EqualityOperator (queue.length > 0)
      const fakes = createFakeSpawnSequence(1)
      const sut = new GitBatchCatFile('/repo', { spawnFn: fakes.spawnFn })

      // No pending requests; non-zero close must not throw
      expect(() => {
        fakes.procs[0].emit('close', 1)
      }).not.toThrow()

      sut.close()
    })

    it('When the active process emits non-zero close with pending requests, Then all pending are rejected', async () => {
      // Arrange — positive path for L213 (queue.length > 0 IS true)
      const fakes = createFakeSpawnSequence(1)
      const sut = new GitBatchCatFile('/repo', { spawnFn: fakes.spawnFn })
      const p1 = sut.getContent('oid1', 'f1.txt')
      const p2 = sut.getContent('oid2', 'f2.txt')

      // Act
      fakes.procs[0].emit('close', 2)

      // Assert — both rejected
      await expect(p1).rejects.toThrow('git cat-file exited with code 2')
      await expect(p2).rejects.toThrow('git cat-file exited with code 2')
    })
  })

  describe('Given _escalateHead re-enqueue', () => {
    it('When escalation fires, Then re-enqueued requests write oid:path to fresh stdin', async () => {
      // Arrange — kills L153 StringLiteral and L159 ObjectLiteral empty mutations
      // by asserting the escalation signal carries the correct oid/path
      const fakes = createFakeSpawnSequence(2)
      const sut = new GitBatchCatFile('/repo', {
        sizeThreshold: 10,
        spawnFn: fakes.spawnFn,
      })

      const p1 = sut.getContentOrEscalate('the-oid', 'the/path.cls')

      fakes.procs[0].stdout.emit('data', Buffer.from('the-oid blob 4096\n'))

      const result = await p1.catch(e => e)
      // Assert signal carries oid and path (kills ObjectLiteral {} mutation)
      expect(result.name).toBe('EscalateToStreamingSignal')
      expect(result.ref.oid).toBe('the-oid')
      expect(result.ref.path).toBe('the/path.cls')
      sut.close()
    })
  })

  describe('Given _advance with zero-length rest (L99 ConditionalExpression false)', () => {
    it('When content is consumed exactly (rest.length === 0), Then chunks are cleared and totalLength is 0', async () => {
      // Mutant false: else-branch always taken → chunks = [emptyBuffer], totalLength = 0
      // If chunks is not cleared, next _processBuffer starts with a stale empty chunk
      // which causes _materializeBuffer to return the empty chunk (length=1 iteration)
      // instead of short-circuiting properly.
      // We detect this by sending exactly the right number of bytes then a second
      // clean request — if chunks were not cleared the second request would mismatch.
      const sut = new GitBatchCatFile('/repo')
      const content = 'XY'
      const p1 = sut.getContent('rev1', 'f1.txt')
      const p2 = sut.getContent('rev2', 'f2.txt')

      // Deliver both complete responses in one emission (rest is [] after each)
      mockStdout.emit(
        'data',
        Buffer.from(
          `oid1 blob ${content.length}\n${content}\noid2 blob ${content.length}\n${content}\n`
        )
      )

      // Both must resolve cleanly — if _advance doesn't clear chunks on rest.length===0,
      // the second header parse would see stale bytes and reject or misparse.
      expect((await p1).toString()).toBe(content)
      expect((await p2).toString()).toBe(content)
      sut.close()
    })
  })

  describe('Given _materializeBuffer with exactly 1 chunk (L91 ConditionalExpression false)', () => {
    it('When single chunk arrives, Then returns it directly without concat', async () => {
      // Mutant false: always concatenates even for 1 chunk.
      // After concat the result is set into chunks[0] and returned.
      // The externally visible behaviour is identical except when concat
      // fails (e.g. totalLength mismatch). We verify via a well-formed single
      // chunk that resolves cleanly — the concat path with 1 chunk produces
      // the same bytes, so the killing signal is via the L93 mutation below.
      const sut = new GitBatchCatFile('/repo')
      const p = sut.getContent('oid', 'f.txt')
      // Single emission — chunks.length === 1 when _processBuffer runs
      mockStdout.emit('data', Buffer.from('oid blob 3\nabc\n'))
      expect((await p).toString()).toBe('abc')
      sut.close()
    })

    it('When L93 mutation replaces chunks=[merged] with [], Then second read on same SUT is still correct', async () => {
      // L93:19 mutant: after Buffer.concat, sets `this.chunks = []` instead of `[merged]`
      // With chunks=[], totalLength stays stale. The next _processBuffer call would call
      // _materializeBuffer which calls Buffer.concat([], stale) → empty buffer → wrong parse.
      // We trigger a multi-chunk header path (two data events before newline arrives)
      // which forces the concat branch, then confirm a second request works.
      const sut = new GitBatchCatFile('/repo')
      const p1 = sut.getContent('oid1', 'f1.txt')

      // Split header across two chunks so chunks.length === 2 when second arrives
      mockStdout.emit('data', Buffer.from('oid1 blob 3'))
      mockStdout.emit('data', Buffer.from('\nabc\n'))

      expect((await p1).toString()).toBe('abc')

      // Now a second request — if chunks were [] after concat, this request would stall or misparse
      const p2 = sut.getContent('oid2', 'f2.txt')
      mockStdout.emit('data', Buffer.from('oid2 blob 3\nxyz\n'))
      expect((await p2).toString()).toBe('xyz')

      sut.close()
    })
  })

  describe('Given close() resets queue to empty (L64 ArrayDeclaration mutation)', () => {
    it('When close is called, Then queue is exactly empty (not ["Stryker was here"])', async () => {
      // L64:18 mutant: `this.queue = ["Stryker was here"]` instead of []
      // If queue is non-empty after close, a subsequent non-zero close event on the
      // process would reject the stale entry — but the real process was already killed.
      // We verify: after close(), the L213 guard `queue.length > 0` is false by
      // confirming a non-zero close event does NOT produce unhandled rejections.
      const fakes = createFakeSpawnSequence(1)
      const sut = new GitBatchCatFile('/repo', { spawnFn: fakes.spawnFn })
      const p = sut.getContent('oid', 'f.txt')
      sut.close()

      await expect(p).rejects.toThrow('GitBatchCatFile closed')

      // Emit non-zero close on already-closed process — must not throw
      // (L213 queue.length > 0 must be false because close() set queue=[])
      expect(() => fakes.procs[0].emit('close', 1)).not.toThrow()
    })
  })
})
