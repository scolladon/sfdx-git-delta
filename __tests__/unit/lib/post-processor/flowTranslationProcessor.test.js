'use strict'
const FlowTranslationProcessor = require('../../../../src/post-processor/flowTranslationProcessor')
const fs = require('fs')
const { mockParse } = require('fast-xml-parser')
const {
  FLOW_DIRECTORY_NAME,
} = require('../../../../src/utils/metadataConstants')
const { copyFiles, scanExtension } = require('../../../../src/utils/fsHelper')
const {
  fillPackageWithParameter,
} = require('../../../../src/utils/packageHelper')

jest.mock('fs-extra')
jest.mock('fs')
jest.mock('fast-xml-parser')
jest.mock('../../../../src/utils/packageHelper')
jest.mock('../../../../src/utils/fsHelper', () => ({
  scanExtension: jest.fn(),
  copyFiles: jest.fn(),
}))

const flowFullName = 'test-flow'
const translationWithFlow = `
<?xml version="1.0" encoding="UTF-8"?>
<Translations xmlns="http://soap.sforce.com/2006/04/metadata">
  <flowDefinitions>
    <flows>
      <screens>
        <fields>
          <fieldText>This is a the text</fieldText>
          <name>Translated_Text</name>
        </fields>
        <name>Screen_To_Translate</name>
      </screens>
    </flows>
    <fullName>${flowFullName}</fullName>
  </flowDefinitions>
</Translations>`

const translationWithoutFlow = `
<?xml version="1.0" encoding="UTF-8"?>
<Translations xmlns="http://soap.sforce.com/2006/04/metadata">
  <customLabels>
    <name>myTickets_Attachments_Delete_Modal_Header_Label</name>
    <label>Supprimer le fichier ?</label>
  </customLabels>
</Translations>`

describe('FlowTranslationProcessor', () => {
  const work = {
    diffs: {
      package: new Map(),
      destructiveChanges: new Map(),
    },
    config: { repo: 'repo', output: 'output', generateDelta: true },
  }
  describe('process', () => {
    let sut
    beforeEach(() => {
      sut = new FlowTranslationProcessor(work)
    })
    describe('when there is no translation file', () => {
      beforeEach(() => {
        // Arrange
        scanExtension.mockImplementationOnce(() => ({
          [Symbol.asyncIterator]: () => ({
            next: () => ({
              done: true,
            }),
          }),
        }))
      })
      it('should not add translation file', async () => {
        // Act
        await sut.process()

        // Assert
        expect(scanExtension).toHaveBeenCalledTimes(1)
        expect(mockParse).not.toHaveBeenCalled()
        expect(fillPackageWithParameter).not.toHaveBeenCalled()
        expect(copyFiles).not.toHaveBeenCalled()
      })
    })

    describe('when there is a translation file without flow def', () => {
      beforeEach(() => {
        // Arrange
        let toggle = true
        let flap = () => {
          toggle = !toggle
          return toggle
        }
        scanExtension.mockImplementationOnce(() => ({
          [Symbol.asyncIterator]: () => ({
            next: () => ({
              value: 'fr.translation-meta.xml',
              done: flap(),
            }),
          }),
        }))
        fs.promises.readFile.mockImplementationOnce(
          () => translationWithoutFlow
        )
        mockParse.mockImplementationOnce(() => ({}))
      })
      it('should not add translation file', async () => {
        // Act
        await sut.process()

        // Assert
        expect(scanExtension).toHaveBeenCalledTimes(1)
        expect(mockParse).toHaveBeenCalledTimes(1)
        expect(fillPackageWithParameter).not.toHaveBeenCalled()
        expect(copyFiles).not.toHaveBeenCalled()
      })
    })

    describe('when there is a translation file with flow def', () => {
      beforeEach(() => {
        // Arrange
        let toggle = true
        let flap = () => {
          toggle = !toggle
          return toggle
        }
        scanExtension.mockImplementationOnce(() => ({
          [Symbol.asyncIterator]: () => ({
            next: () => ({
              value: 'fr.translation-meta.xml',
              done: flap(),
            }),
          }),
        }))
        fs.promises.readFile.mockImplementationOnce(() => translationWithFlow)
      })
      describe('when there is no flow matching the translation', () => {
        beforeEach(() => {
          mockParse.mockImplementationOnce(() => ({
            Translations: { flowDefinitions: [{ fullName: 'wrong' }] },
          }))
        })
        it('should not add translation', async () => {
          // Arrange

          // Act
          await sut.process()

          // Assert
          expect(scanExtension).toHaveBeenCalledTimes(1)
          expect(mockParse).toHaveBeenCalledTimes(1)
          expect(fillPackageWithParameter).not.toHaveBeenCalled()
          expect(copyFiles).not.toHaveBeenCalled()
        })
      })

      describe('when there is flow matching the translation', () => {
        describe.each([true, false])(
          'when config.generateDelta is %s',
          generateDelta => {
            beforeEach(() => {
              mockParse.mockImplementationOnce(() => ({
                Translations: { flowDefinitions: [{ fullName: flowFullName }] },
              }))
              work.diffs.package = new Map([
                [FLOW_DIRECTORY_NAME, new Set([flowFullName])],
              ])
              work.config.generateDelta = generateDelta
            })
            it('should add translation', async () => {
              // Arrange

              // Act
              await sut.process()

              // Assert
              expect(scanExtension).toHaveBeenCalledTimes(1)
              expect(mockParse).toHaveBeenCalledTimes(1)
              expect(fillPackageWithParameter).toHaveBeenCalledTimes(1)
              expect(copyFiles).toHaveBeenCalledTimes(generateDelta ? 1 : 0)
            })
          }
        )
      })
    })
  })
})
