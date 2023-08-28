'use strict'
const DiffLineInterpreter = require('../../../../src/service/diffLineInterpreter')

const mockHandle = jest.fn()
jest.mock('../../../../src/service/typeHandlerFactory', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getTypeHandler: jest.fn().mockImplementation(() => {
        return { handle: mockHandle }
      }),
    }
  })
})

let work
let sut
beforeEach(() => {
  jest.clearAllMocks()
  work = {
    config: { output: '', repo: '', generateDelta: true },
    diffs: { package: new Map(), destructiveChanges: new Map() },
  }
  sut = new DiffLineInterpreter()
})

describe('DiffLineInterpreter', () => {
  let globalMetadata
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })

  beforeEach(() => {
    sut = new DiffLineInterpreter(work, globalMetadata)
  })

  describe('when called with lines', () => {
    it('process each lines', () => {
      // Arrange
      const lines = ['test']

      // Act
      sut.process(lines)

      // Assert
      expect(mockHandle).toBeCalledTimes(1)
    })
  })

  describe('when called without lines', () => {
    it('it does not process anything', () => {
      // Arrange
      const lines = []

      // Act
      sut.process(lines)

      // Assert
      expect(mockHandle).not.toBeCalled()
    })
  })
})
