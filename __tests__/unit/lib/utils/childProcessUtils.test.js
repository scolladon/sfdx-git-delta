'use strict'
const {
  EOLRegex,
  getStreamContent,
  linify,
  treatPathSep,
  sanitizePath,
} = require('../../../../src/utils/childProcessUtils')
const { EventEmitter, Readable } = require('stream')
const { sep } = require('path')

describe('childProcessUtils', () => {
  describe('getStreamContent', () => {
    describe.each([Buffer.from('text'), 'text'])(
      'when called with stream of %o',
      content => {
        it('returns Buffer', async () => {
          // Arrange
          const stream = new EventEmitter()
          stream.stdout = new Readable({
            read() {
              this.push(content)
              this.push(null)
              stream.emit('close')
            },
          })
          stream.stderr = new Readable({
            read() {
              this.push(null)
              stream.emit('close')
            },
          })

          // Act
          const result = await getStreamContent(stream)

          // Assert
          expect(result).toEqual(Buffer.from('text'))
        })
      }
    )

    describe('when stream emit error', () => {
      it('throws the error', async () => {
        // Arrange
        expect.assertions(1)
        const stream = new EventEmitter()
        stream.stdout = new Readable({
          read() {
            this.push(null)
            stream.emit('close')
          },
        })

        stream.stderr = new Readable({
          read() {
            this.push('error')
            this.push(null)
            stream.emit('close')
          },
        })

        // Act
        try {
          await getStreamContent(stream)

          // Assert
        } catch (error) {
          expect(error.message).toEqual('error')
        }
      })
    })
  })
  describe('linify', () => {
    describe('when called with lines', () => {
      it('yield content line by line', async () => {
        // Arrange
        const input = 'multiline\ntext'
        const stream = new Readable.from(input)

        // Act
        const lines = []
        for await (const line of linify(stream)) {
          lines.push(line)
        }

        // Assert
        expect(lines).toEqual(expect.arrayContaining(input.split('\n')))
      })
    })

    describe('when stream has no content in stdout', () => {
      it('returns no lines', async () => {
        // Arrange
        const stream = new Readable({
          read() {
            this.push(null)
          },
        })

        // Act
        const lines = []
        for await (const line of linify(stream)) {
          lines.push(line)
        }

        // Assert
        expect(lines).toEqual([])
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
    describe.each([undefined, null])('when called with %s', val => {
      it(`returns  ${val}`, () => {
        // Act
        const result = sanitizePath(val)

        // Assert
        expect(result).toEqual(val)
      })
    })

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
