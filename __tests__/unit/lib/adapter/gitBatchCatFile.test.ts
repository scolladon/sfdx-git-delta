'use strict'
import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'

import { GitBatchCatFile } from '../../../../src/adapter/gitBatchCatFile'

vi.mock('../../../../src/utils/LoggingService')

const mockStdin = {
  write: vi.fn(),
  end: vi.fn(),
}
const mockStdout = new EventEmitter()
const mockStderr = new EventEmitter()
const mockProcess = Object.assign(new EventEmitter(), {
  stdin: mockStdin,
  stdout: mockStdout,
  stderr: mockStderr,
  killed: false,
  kill: vi.fn(() => {
    ;(mockProcess as { killed: boolean }).killed = true
  }),
})

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => mockProcess),
}))

describe('GitBatchCatFile', () => {
  describe('Given a successful content read', () => {
    it('When getContent is called, Then returns the file content', async () => {
      // Arrange
      ;(mockProcess as { killed: boolean }).killed = false
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
      ;(mockProcess as { killed: boolean }).killed = false
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
      ;(mockProcess as { killed: boolean }).killed = false
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
      ;(mockProcess as { killed: boolean }).killed = false
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
      ;(mockProcess as { killed: boolean }).killed = false
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
      ;(mockProcess as { killed: boolean }).killed = false
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
      ;(mockProcess as { killed: boolean }).killed = false
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
      ;(mockProcess as { killed: boolean }).killed = false
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
      ;(mockProcess as { killed: boolean }).killed = false
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
})
