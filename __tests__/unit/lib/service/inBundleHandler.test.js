'use strict'
const InBundleHandler = require('../../../../src/service/inBundleHandler')

jest.mock('../../../../src/utils/fsHelper')
jest.mock('fs-extra')
jest.mock('fs')

const objectType = 'digitalExperiences'
const entityPath =
  'force-app/main/default/digitalExperiences/site/component.digitalExperience-meta.xml'
const line = `A       ${entityPath}`
let work
beforeEach(() => {
  jest.clearAllMocks()
  work = {
    config: { output: '', repo: '' },
    diffs: { package: new Map(), destructiveChanges: new Map() },
  }
})

describe('InBundleHandler', () => {
  let globalMetadata
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })

  describe('_getElementName', () => {
    describe('when called with meta file', () => {
      it('returns <site workspace>/<workspace name>', () => {
        // Arrange
        const sut = new InBundleHandler(line, objectType, work, globalMetadata)

        // Act
        const result = sut._getElementName()

        // Assert
        expect(result).toEqual('site/component')
      })
    })

    describe('when called with sub workspace file', () => {
      it('returns <site workspace>/<workspace name>', () => {
        // Arrange
        const entityPath =
          'force-app/main/default/digitalExperiences/site/component/workspace/file.json'
        const line = `A       ${entityPath}`
        const sut = new InBundleHandler(line, objectType, work, globalMetadata)

        // Act
        const result = sut._getElementName()

        // Assert
        expect(result).toEqual('site/component')
      })
    })
  })
})
