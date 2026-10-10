'use strict'
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'

vi.mock('../../../../src/utils/LoggingService')

import { ObjectId } from '@scolladon/tsgit'
import type { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import { NO_UNIONS } from '../../../../src/types/runContext'
import { comparisonName } from '../../../../src/utils/comparisonName'
import { Logger } from '../../../../src/utils/LoggingService'
import PureMoveResolver, {
  type MovePorts,
} from '../../../../src/utils/pureMoveResolver'
import type { DeferredDeletion } from '../../../../src/utils/repoGitDiff'
import { getConfig, getContext } from '../../../__utils__/testWork'

const mockGetTypeHandler = vi.fn()
vi.mock('../../../../src/service/typeHandlerFactory', () => ({
  default: vi.fn().mockImplementation(function () {
    return { getTypeHandler: mockGetTypeHandler }
  }),
}))

const FROM = 'from-sha'
const TO = 'to-sha'
const OLD_DIR = 'force-app/main/default/classes'
const NEW_DIR = 'force-app/other/classes'
const OLD_CLS = `${OLD_DIR}/Foo.cls`
const OLD_META = `${OLD_DIR}/Foo.cls-meta.xml`
const NEW_CLS = `${NEW_DIR}/Foo.cls`
const NEW_META = `${NEW_DIR}/Foo.cls-meta.xml`
const UNRELATED = 'A\tforce-app/main/default/classes/Other.cls'
const PROJECT = JSON.stringify({
  packageDirectories: [{ path: 'force-app' }],
})

const blobs = (entries: Record<string, string>): Map<string, ObjectId> =>
  new Map(
    Object.entries(entries).map(([path, hex]) => [
      path,
      ObjectId.from(hex.padEnd(40, '0')),
    ])
  )

type Layout = {
  from: Record<string, string>
  to: Record<string, string>
}

const sameBlobs: Layout = {
  from: { [OLD_CLS]: 'a1', [OLD_META]: 'b1' },
  to: { [NEW_CLS]: 'a1', [NEW_META]: 'b1' },
}

const handlerAnswering = (member: string, comparesElements = false) => ({
  getElementDescriptor: () => ({ type: 'ApexClass', member }),
  comparesElements: () => comparesElements,
})

describe('PureMoveResolver', () => {
  let metadata: MetadataRepository
  let ports: MovePorts
  let getBlobIds: Mock<MovePorts['getBlobIds']>
  let getRootFileContent: Mock<MovePorts['getRootFileContent']>

  const deletion = (path: string): DeferredDeletion => {
    const line = `D\t${path}`
    return { line, name: comparisonName(metadata, line) }
  }

  const arrange = (layout: Layout = sameBlobs, rootFile = PROJECT) => {
    getBlobIds.mockImplementation(async (rev: string) =>
      rev === FROM ? blobs(layout.from) : blobs(layout.to)
    )
    getRootFileContent.mockResolvedValue(rootFile)
    mockGetTypeHandler.mockImplementation(async () => handlerAnswering('Foo'))
  }

  const newSut = () =>
    new PureMoveResolver(
      getContext({
        config: { ...getConfig(), from: FROM, to: TO },
        metadata,
      }),
      ports
    )

  const lines = [
    `A\t${NEW_CLS}`,
    UNRELATED,
    `A\t${NEW_META}`,
    'M\tforce-app/main/default/classes/Kept.cls',
  ]
  const cancelled = () => [deletion(OLD_CLS), deletion(OLD_META)]

  beforeEach(async () => {
    metadata = await getDefinition({})
    getBlobIds = vi.fn<MovePorts['getBlobIds']>()
    getRootFileContent = vi.fn<MovePorts['getRootFileContent']>()
    ports = { getBlobIds, getRootFileContent }
    mockGetTypeHandler.mockReset()
    vi.mocked(Logger.debug).mockClear()
    arrange()
  })

  describe('Given no cancelled deletion', () => {
    it('When resolve runs, Then lines are unchanged, no unions, checkSkipped false and no git port is touched', async () => {
      // Arrange
      const sut = newSut()

      // Act
      const result = await sut.resolve(lines, [])

      // Assert
      expect(result).toEqual({
        lines,
        unions: NO_UNIONS,
        checkSkipped: false,
      })
      expect(getBlobIds).not.toHaveBeenCalled()
      expect(getRootFileContent).not.toHaveBeenCalled()
    })
  })

  describe('Given a class pair moved inside one package directory with identical blobs', () => {
    it('When resolve runs, Then both addition lines are dropped and the other lines keep their order', async () => {
      // Arrange
      const sut = newSut()

      // Act
      const result = await sut.resolve(lines, cancelled())

      // Assert
      expect(result.lines).toEqual([lines[1], lines[3]])
      expect(result.checkSkipped).toBe(false)
      expect(result.unions).toBe(NO_UNIONS)
    })
  })

  describe('Given a move that is not pure', () => {
    const changedBlob = (path: string): Layout => ({
      from: sameBlobs.from,
      to: { ...sameBlobs.to, [path]: 'ff' },
    })
    it.each<[string, () => void]>([
      [
        'the member differs by case',
        () =>
          mockGetTypeHandler.mockImplementation(async (line: string) =>
            handlerAnswering(line.startsWith('D') ? 'Foo' : 'foo')
          ),
      ],
      [
        'a probe compares elements',
        () =>
          mockGetTypeHandler.mockImplementation(async () =>
            handlerAnswering('Foo', true)
          ),
      ],
      [
        'the package directories differ',
        () =>
          arrange(
            sameBlobs,
            JSON.stringify({
              packageDirectories: [
                { path: 'force-app/main' },
                { path: 'force-app/other' },
              ],
            })
          ),
      ],
      ['the class blob differs', () => arrange(changedBlob(NEW_CLS))],
      ['the meta blob differs', () => arrange(changedBlob(NEW_META))],
      [
        'the relative layouts differ',
        () =>
          arrange({
            from: sameBlobs.from,
            to: { [`${NEW_DIR}/sub/Foo.cls`]: 'a1', [NEW_META]: 'b1' },
          }),
      ],
      [
        'the addition count differs from the deletion count',
        () =>
          arrange({
            from: sameBlobs.from,
            to: { [NEW_CLS]: 'a1' },
          }),
      ],
      [
        'a deletion has no blob id',
        () =>
          arrange({
            from: { [OLD_CLS]: 'a1' },
            to: sameBlobs.to,
          }),
      ],
    ])('When %s, Then the addition lines are kept', async (_title, setup) => {
      // Arrange
      setup()
      const sut = newSut()

      // Act
      const result = await sut.resolve(lines, cancelled())

      // Assert
      expect(result.lines).toEqual(lines)
    })
  })

  describe('Given the revision view cannot load', () => {
    it.each<[string, () => void]>([
      [
        'getBlobIds rejects',
        () => getBlobIds.mockRejectedValue(new Error('git exploded')),
      ],
      [
        'sfdx-project.json is not JSON',
        () => getRootFileContent.mockResolvedValue('{nope'),
      ],
    ])(
      'When %s, Then lines are unchanged, checkSkipped is true and the cause is logged',
      async (_title, setup) => {
        // Arrange
        setup()
        const sut = newSut()

        // Act
        const result = await sut.resolve(lines, cancelled())

        // Assert
        expect(result).toEqual({ lines, unions: NO_UNIONS, checkSkipped: true })
        expect(Logger.debug).toHaveBeenCalled()
      }
    )
  })

  describe('Given the handler lookup rejects for one group', () => {
    it('When resolve runs, Then that group is kept, the other pure group is dropped and the failure is logged', async () => {
      // Arrange
      const barOld = `${OLD_DIR}/Bar.cls`
      const barNew = `${NEW_DIR}/Bar.cls`
      getBlobIds.mockImplementation(async (rev: string) =>
        rev === FROM
          ? blobs({ [OLD_CLS]: 'a1', [barOld]: 'c2' })
          : blobs({ [NEW_CLS]: 'a1', [barNew]: 'c2' })
      )
      mockGetTypeHandler.mockImplementation(async (line: string) => {
        if (line.endsWith('Bar.cls')) throw new Error('lookup failed')
        return handlerAnswering('Foo')
      })
      const input = [`A\t${NEW_CLS}`, `A\t${barNew}`]
      const sut = newSut()

      // Act
      const result = await sut.resolve(input, [
        deletion(OLD_CLS),
        deletion(barOld),
      ])

      // Assert
      expect(result.lines).toEqual([`A\t${barNew}`])
      expect(result.checkSkipped).toBe(false)
      expect(Logger.debug).toHaveBeenCalled()
    })
  })
})
