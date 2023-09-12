'use strict'
import { expect, describe, it } from '@jest/globals'
import {
  EOLRegex,
  getSpawnContent,
  getSpawnContentByLine,
  treatPathSep,
  sanitizePath,
} from '../../../../src/utils/childProcessUtils'
import { EventEmitter, Readable } from 'stream'
import { sep } from 'path'
import { ChildProcess, spawn } from 'child_process'

jest.mock('child_process')

const mockedSpawn = jest.mocked(spawn)

const cmd = 'command'
const args = ['arg1', 'arg2']

const arrangeStream = (
  data: Buffer | string,
  error: string | null,
  isError: boolean
) => {
  const getReadable = (content: Buffer | string | null) => {
    return new Readable({
      read() {
        if (content) this.push(content)
        this.push(null)
      },
    })
  }
  const stream: ChildProcess = new EventEmitter() as ChildProcess
  stream.stdout = getReadable(data)
  stream.stderr = getReadable(error)
  setTimeout(() => stream.emit('close', isError ? 1 : 0), 0)
  return stream
}

describe('childProcessUtils', () => {
  describe('getSpawnContent', () => {
    describe.each([Buffer.from('text'), 'text'])(
      'when spawn returns %o',
      content => {
        it('returns Buffer', async () => {
          // Arrange
          const stream = arrangeStream(content, null, false)
          mockedSpawn.mockReturnValue(stream)

          // Act
          const result = await getSpawnContent(cmd, args)

          // Assert
          expect(result).toEqual(Buffer.from('text'))
        })
      }
    )

    describe('when stream emits error', () => {
      it('throws the error', async () => {
        // Arrange
        expect.assertions(1)
        const mockedStream = arrangeStream(
          'irrelevant std out output',
          'error',
          true
        )
        mockedSpawn.mockReturnValue(mockedStream)

        // Act
        try {
          await getSpawnContent(cmd, args)

          // Assert
        } catch (error) {
          expect((error as Error).message).toEqual('error')
        }
      })
    })

    describe('when stream emits error but no stderr output', () => {
      it('throws an empty error', async () => {
        // Arrange
        expect.assertions(1)
        const stream = arrangeStream('irrelevant std out output', null, true)
        mockedSpawn.mockReturnValue(stream)

        // Act
        try {
          await getSpawnContent(cmd, args)

          // Assert
        } catch (error) {
          expect((error as Error).message).toEqual('')
        }
      })
    })
  })
  describe('getSpawnContentByLine', () => {
    describe('when called with lines', () => {
      it('gives an array containing those lines', async () => {
        // Arrange
        const input = 'multiline\ntext'

        const stream = arrangeStream(input, null, false)
        mockedSpawn.mockReturnValue(stream)

        // Act
        const lines = await getSpawnContentByLine(cmd, args)

        // Assert
        expect(lines).toEqual(expect.arrayContaining(input.split('\n')))
      })
    })

    describe('when stream has no content in stdout', () => {
      it('returns no lines', async () => {
        // Arrange
        const stream = arrangeStream('', null, false)
        mockedSpawn.mockReturnValue(stream)

        // Act
        const lines = await getSpawnContentByLine(cmd, args)

        // Assert
        expect(lines).toEqual([])
      })
    })

    describe('when stream emits error', () => {
      it('throws the error', async () => {
        // Arrange
        expect.assertions(1)
        const mockedStream = arrangeStream(
          'irrelevant std out output',
          'error',
          true
        )
        mockedSpawn.mockReturnValue(mockedStream)

        // Act
        try {
          await getSpawnContentByLine(cmd, args)

          // Assert
        } catch (error) {
          expect((error as Error).message).toEqual('error')
        }
      })
    })

    describe('when stream emits error but no stderr output', () => {
      it('throws an empty error', async () => {
        // Arrange
        expect.assertions(1)
        const stream = arrangeStream('irrelevant std out output', null, true)
        mockedSpawn.mockReturnValue(stream)

        // Act
        try {
          await getSpawnContentByLine(cmd, args)

          // Assert
        } catch (error) {
          expect((error as Error).message).toEqual('')
        }
      })
    })
  })
  describe('treatPathSep', () => {
    it(`replace / by ${sep}`, () => {
      // Arrange
      const input = 'test///test//test/test'

      // Act
      const result = treatPathSep(input)

      // Assert
      expect(result).toBe(`test${sep}test${sep}test${sep}test`)
    })

    it(`replace \\ by ${sep}`, () => {
      // Arrange
      const input = 'test\\\\\\test\\\\test\\test'

      // Act
      const result = treatPathSep(input)

      // Assert
      expect(result).toBe(`test${sep}test${sep}test${sep}test`)
    })
  })
  describe('sanitizePath', () => {
    it(`returns path with '${sep}' separator`, () => {
      // Arrange
      const input = 'test\\test/test'

      // Act
      const result = sanitizePath(input)

      // Assert
      expect(result).toBe(`test${sep}test${sep}test`)
    })

    it(`normalize path`, () => {
      // Arrange
      const input = 'test/test\\../test'

      // Act
      const result = sanitizePath(input)

      // Assert
      expect(result).toBe(`test${sep}test`)
    })
  })
  describe('EOLRegex', () => {
    it('matches CR LF', () => {
      // Arrange
      const input = 'test\r\ntest'

      // Act
      const matches = EOLRegex.test(input)

      // Assert
      expect(matches).toBe(true)
    })

    it('matches LF', () => {
      // Arrange
      const input = 'testtest\n'

      // Act
      const matches = EOLRegex.test(input)

      // Assert
      expect(matches).toBe(true)
    })

    it('does not matches CR only', () => {
      // Arrange
      const input = 'test\rtest'

      // Act
      const matches = EOLRegex.test(input)

      // Assert
      expect(matches).toBe(false)
    })

    it('does not matches any string ', () => {
      // Arrange
      const input = 'test,test'

      // Act
      const matches = EOLRegex.test(input)

      // Assert
      expect(matches).toBe(false)
    })
  })
})
