'use strict'
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'

vi.mock('../../../../src/utils/LoggingService')

import { ObjectId } from '@scolladon/tsgit'
import type { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import { NO_UNIONS, type UnionOutcomes } from '../../../../src/types/runContext'
import { comparisonName } from '../../../../src/utils/comparisonName'
import { Logger } from '../../../../src/utils/LoggingService'
import type {
  DiffOutcome,
  UnionDiffInput,
} from '../../../../src/utils/metadataDiff'
import PureMoveResolver, {
  type MovePorts,
} from '../../../../src/utils/pureMoveResolver'
import type { DeferredDeletion } from '../../../../src/utils/repoGitDiff'
import { sourceDirs } from '../../../__utils__/sourceDirs'
import { getConfig, getContext } from '../../../__utils__/testWork'

const mockGetTypeHandler = vi.fn()
vi.mock('../../../../src/service/typeHandlerFactory', () => ({
  default: vi.fn().mockImplementation(function () {
    return { getTypeHandler: mockGetTypeHandler }
  }),
}))

const mockKeep = vi.fn<(line: string) => boolean>()
vi.mock('../../../../src/utils/ignoreHelper', () => ({
  buildIgnoreHelper: vi.fn(async () => ({ keep: mockKeep })),
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

class ScanCountingMap extends Map<string, ObjectId> {
  constructor(private readonly onScan: () => void) {
    super()
  }

  override keys(): MapIterator<string> {
    this.onScan()
    return super.keys()
  }

  override entries(): MapIterator<[string, ObjectId]> {
    this.onScan()
    return super.entries()
  }

  override values(): MapIterator<ObjectId> {
    this.onScan()
    return super.values()
  }

  override forEach(
    callback: (value: ObjectId, key: string, map: Map<string, ObjectId>) => void
  ): void {
    this.onScan()
    super.forEach(callback)
  }

  override [Symbol.iterator](): MapIterator<[string, ObjectId]> {
    this.onScan()
    return super[Symbol.iterator]()
  }
}

type Layout = {
  from: Record<string, string>
  to: Record<string, string>
}

const sameBlobs: Layout = {
  from: { [OLD_CLS]: 'a1', [OLD_META]: 'b1' },
  to: { [NEW_CLS]: 'a1', [NEW_META]: 'b1' },
}

const BAR_OLD = `${OLD_DIR}/Bar.cls`
const BAR_NEW = `${NEW_DIR}/Bar.cls`
const BAR_BLOBS: Layout = {
  from: { [BAR_OLD]: 'c2' },
  to: { [BAR_NEW]: 'c2' },
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
  let runUnion: Mock<(spec: UnionDiffInput) => Promise<UnionOutcomes>>

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

  const debugMessages = (): string[] =>
    vi
      .mocked(Logger.debug)
      .mock.calls.map(([message]) =>
        typeof message === 'function' ? String(message()) : String(message)
      )

  const newSut = () =>
    new PureMoveResolver(
      getContext({
        config: { ...getConfig(), from: FROM, to: TO },
        metadata,
      }),
      ports,
      { runUnion }
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
    runUnion = vi.fn().mockResolvedValue(new Map())
    mockGetTypeHandler.mockReset()
    mockKeep.mockReset().mockReturnValue(true)
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
      expect(result.unions).toEqual(NO_UNIONS)
    })
  })

  describe('Given a modified file named like the moved component', () => {
    it('When resolve runs, Then it is not counted among the moved additions and the move stays pure', async () => {
      // Arrange
      const modified = 'M\tforce-app/third/classes/Foo.cls'
      const sut = newSut()

      // Act
      const result = await sut.resolve([...lines, modified], cancelled())

      // Assert
      expect(result.lines).toEqual([lines[1], lines[3], modified])
    })
  })

  describe('Given the same deletion reported once per rename destination', () => {
    it('When resolve runs, Then the move is judged as if it was reported once', async () => {
      // Arrange
      const sut = newSut()

      // Act
      const result = await sut.resolve(lines, [
        ...cancelled(),
        deletion(OLD_CLS),
      ])

      // Assert
      expect(result.lines).toEqual([lines[1], lines[3]])
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
        'a moved file is absent from the --to listing',
        () =>
          arrange({
            from: sameBlobs.from,
            to: { [`${NEW_DIR}/sub/Foo.cls`]: 'a1', [NEW_META]: 'b1' },
          }),
      ],
      [
        'the --to listing lacks the meta file',
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

  describe('Given a move across two package directories', () => {
    const crossEntryProject = JSON.stringify({
      packageDirectories: [
        { path: 'force-app/main' },
        { path: 'force-app/other' },
      ],
    })

    it('When the handler does not compare elements, Then only one line of the group is probed and the additions are kept', async () => {
      // Arrange
      arrange(sameBlobs, crossEntryProject)
      const sut = newSut()

      // Act
      const result = await sut.resolve(lines, cancelled())

      // Assert
      expect(result.lines).toEqual(lines)
      expect(mockGetTypeHandler).toHaveBeenCalledTimes(1)
    })

    it('When the handler compares elements, Then every line of the group is probed', async () => {
      // Arrange
      arrange(sameBlobs, crossEntryProject)
      mockGetTypeHandler.mockImplementation(async () =>
        handlerAnswering('Foo', true)
      )
      const sut = newSut()

      // Act
      const result = await sut.resolve(lines, cancelled())

      // Assert
      expect(result.lines).toEqual(lines)
      expect(mockGetTypeHandler).toHaveBeenCalledTimes(4)
    })
  })

  describe('Given a spanning move whose first line cannot be probed', () => {
    it('When resolve runs, Then the group is kept without probing its other lines', async () => {
      // Arrange
      const crossEntryProject = JSON.stringify({
        packageDirectories: [
          { path: 'force-app/main' },
          { path: 'force-app/other' },
        ],
      })
      arrange(sameBlobs, crossEntryProject)
      mockGetTypeHandler.mockRejectedValue(new Error('lookup failed'))
      const sut = newSut()

      // Act
      const result = await sut.resolve(lines, cancelled())

      // Assert
      expect(result.lines).toEqual(lines)
      expect(result.checkSkipped).toBe(false)
      expect(mockGetTypeHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('Given the revision view cannot load', () => {
    const parseCause = (() => {
      try {
        JSON.parse('{nope')
      } catch (error) {
        return (error as Error).message
      }
      return ''
    })()

    it.each<[string, () => void, string]>([
      [
        'getBlobIds rejects',
        () => getBlobIds.mockRejectedValue(new Error('git exploded')),
        'git exploded',
      ],
      [
        'sfdx-project.json is not JSON',
        () => getRootFileContent.mockResolvedValue('{nope'),
        `Invalid sfdx-project.json: ${parseCause}`,
      ],
    ])(
      'When %s, Then lines are unchanged, checkSkipped is true and the cause is logged',
      async (_title, setup, cause) => {
        // Arrange
        setup()
        const sut = newSut()

        // Act
        const result = await sut.resolve(lines, cancelled())

        // Assert
        expect(result).toEqual({ lines, unions: NO_UNIONS, checkSkipped: true })
        expect(debugMessages()).toContain(`Pure move check skipped: ${cause}`)
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
      expect(debugMessages().join('\n')).toContain(
        `Pure move probe failed for A\t${barNew}: lookup failed`
      )
    })
  })

  describe('Given a move whose source or completeness is not established', () => {
    it('When the moved source sits under the ignore file while its deletion survived, Then the additions are kept', async () => {
      // Arrange
      mockKeep.mockImplementation(line => line !== `A\t${OLD_CLS}`)
      const sut = newSut()

      // Act
      const result = await sut.resolve(lines, cancelled())

      // Assert
      expect(result.lines).toEqual(lines)
    })

    it('When only the class file moved and its meta file stayed, Then the addition is kept', async () => {
      // Arrange
      const sut = newSut()
      const input = [`A\t${NEW_CLS}`]

      // Act
      const result = await sut.resolve(input, [deletion(OLD_CLS)])

      // Assert
      expect(result.lines).toEqual(input)
    })

    it('When the destination holds an extra file of the component at --to, Then the additions are kept', async () => {
      // Arrange
      arrange({
        from: sameBlobs.from,
        to: { ...sameBlobs.to, [`${NEW_DIR}/sub/Foo.cls`]: 'a1' },
      })
      const sut = newSut()

      // Act
      const result = await sut.resolve(lines, cancelled())

      // Assert
      expect(result.lines).toEqual(lines)
    })
  })

  describe('Given a move whose destination layout differs from its source layout', () => {
    it('When an extra file of the component arrives with no deletion, Then the additions are kept', async () => {
      // Arrange
      const extra = `${NEW_DIR}/sub/Foo.cls`
      arrange({
        from: sameBlobs.from,
        to: { ...sameBlobs.to, [extra]: 'a1' },
      })
      const sut = newSut()
      const input = [...lines, `A\t${extra}`]

      // Act
      const result = await sut.resolve(input, cancelled())

      // Assert
      expect(result.lines).toEqual(input)
    })
  })

  describe('Given a move whose component cannot be listed', () => {
    it('When the files live outside their type directory, Then the additions are kept and the other pure group is still dropped', async () => {
      // Arrange
      const oldCls = 'force-app/x/Foo.cls'
      const newCls = 'force-app/y/Foo.cls'
      arrange({
        from: { [oldCls]: 'a1', ...BAR_BLOBS.from },
        to: { [newCls]: 'a1', ...BAR_BLOBS.to },
      })
      mockGetTypeHandler.mockImplementation(async (line: string) =>
        handlerAnswering(line.includes('Bar') ? 'Bar' : 'Foo')
      )
      const sut = newSut()

      // Act
      const result = await sut.resolve(
        [`A\t${newCls}`, `A\t${BAR_NEW}`],
        [deletion(oldCls), deletion(BAR_OLD)]
      )

      // Assert
      expect(result.lines).toEqual([`A\t${newCls}`])
      expect(result.checkSkipped).toBe(false)
    })
  })

  describe('Given revisions holding files foreign to the moved component', () => {
    it('When they are not part of the component, Then the move is still pure', async () => {
      // Arrange
      arrange({
        from: {
          ...sameBlobs.from,
          [`${OLD_DIR}/Other.cls`]: 'c3',
          [`${OLD_DIR}/readme.txt`]: 'd4',
          'elsewhere/classes/Foo.cls': 'e5',
        },
        to: {
          ...sameBlobs.to,
          [`${NEW_DIR}/Other.cls`]: 'c3',
          [`${NEW_DIR}/readme.txt`]: 'd4',
        },
      })
      const sut = newSut()

      // Act
      const result = await sut.resolve(lines, cancelled())

      // Assert
      expect(result.lines).toEqual([lines[1], lines[3]])
    })
  })

  describe('Given a sibling of the moved component ignored by the ignore file', () => {
    it('When the sibling sits in the same type directory, Then the move is still pure', async () => {
      // Arrange
      const sibling = `${OLD_DIR}/Ignored.cls`
      arrange({
        from: { ...sameBlobs.from, [sibling]: 'c3' },
        to: sameBlobs.to,
      })
      mockKeep.mockImplementation(line => !line.endsWith(sibling))
      const sut = newSut()

      // Act
      const result = await sut.resolve(lines, cancelled())

      // Assert
      expect(result.lines).toEqual([lines[1], lines[3]])
    })
  })

  describe('Given an extra file of the moved component at --to ignored by the ignore file', () => {
    it('When the extra file sits inside the listing root, Then the move is still pure', async () => {
      // Arrange
      const extra = `${NEW_DIR}/sub/Foo.cls`
      arrange({
        from: sameBlobs.from,
        to: { ...sameBlobs.to, [extra]: 'a1' },
      })
      mockKeep.mockImplementation(line => !line.endsWith(extra))
      const sut = newSut()

      // Act
      const result = await sut.resolve(lines, cancelled())

      // Assert
      expect(result.lines).toEqual([lines[1], lines[3]])
    })
  })

  describe('Given a sibling of the moved component outside the source', () => {
    it('When the sibling sits in the same type directory, Then the move is still pure', async () => {
      // Arrange
      arrange({
        from: { ...sameBlobs.from, [`${OLD_DIR}/Outside.cls`]: 'c3' },
        to: sameBlobs.to,
      })
      const sut = new PureMoveResolver(
        getContext({
          config: {
            ...getConfig(),
            from: FROM,
            to: TO,
            source: sourceDirs(OLD_CLS, OLD_META, NEW_CLS, NEW_META),
          },
          metadata,
        }),
        ports,
        { runUnion }
      )

      // Act
      const result = await sut.resolve(lines, cancelled())

      // Assert
      expect(result.lines).toEqual([lines[1], lines[3]])
    })
  })

  describe('Given many moved components', () => {
    it('When resolve runs, Then each revision listing is scanned once', async () => {
      // Arrange
      const scans = new Map<string, number>()
      const names = ['Aa', 'Bb', 'Cc', 'Dd', 'Ee']
      const pathsIn = (dir: string) =>
        names.flatMap(name => [
          `${dir}/${name}.cls`,
          `${dir}/${name}.cls-meta.xml`,
        ])
      const countingBlobs = (rev: string, dir: string) => {
        const map = new ScanCountingMap(() =>
          scans.set(rev, (scans.get(rev) ?? 0) + 1)
        )
        for (const path of pathsIn(dir)) {
          map.set(path, ObjectId.from('a1'.padEnd(40, '0')))
        }
        return map
      }
      getBlobIds.mockImplementation(async (rev: string) =>
        countingBlobs(rev, rev === FROM ? OLD_DIR : NEW_DIR)
      )
      mockGetTypeHandler.mockImplementation(async (line: string) =>
        handlerAnswering(line.split('/').pop()!.split('.')[0]!)
      )
      const input = pathsIn(NEW_DIR).map(path => `A\t${path}`)
      const moved = pathsIn(OLD_DIR).map(path => deletion(path))
      const sut = newSut()

      // Act
      const result = await sut.resolve(input, moved)

      // Assert
      expect(result.lines).toEqual([])
      expect(scans.get(FROM)).toBe(1)
      expect(scans.get(TO)).toBe(1)
    })
  })

  describe('Given moves needing no listing', () => {
    it('When no group passes the cheap checks, Then no revision listing is scanned', async () => {
      // Arrange
      let scans = 0
      const countingBlobs = () => {
        const map = new ScanCountingMap(() => scans++)
        map.set(OLD_CLS, ObjectId.from('a1'.padEnd(40, '0')))
        return map
      }
      getBlobIds.mockImplementation(async () => countingBlobs())
      mockGetTypeHandler.mockImplementation(async (line: string) =>
        handlerAnswering(line.startsWith('D') ? 'Foo' : 'foo')
      )
      const sut = newSut()

      // Act
      await sut.resolve(lines, cancelled())

      // Assert
      expect(scans).toBe(0)
    })
  })

  describe('Given many union specs', () => {
    it('When resolve runs, Then each revision listing is scanned once', async () => {
      // Arrange
      const scans = new Map<string, number>()
      const count = 50
      const OLD_ROOT = 'force-app/main/default'
      const NEW_ROOT = 'force-app/other'
      const workflowsIn = (dir: string) =>
        Array.from(
          { length: count },
          (_, index) => `${dir}/workflows/Wf${index}.workflow-meta.xml`
        )
      const countingBlobs = (rev: string, dir: string) => {
        const map = new ScanCountingMap(() =>
          scans.set(rev, (scans.get(rev) ?? 0) + 1)
        )
        for (const path of workflowsIn(dir)) {
          map.set(path, ObjectId.from('a1'.padEnd(40, '0')))
        }
        return map
      }
      getBlobIds.mockImplementation(async (rev: string) =>
        countingBlobs(rev, rev === FROM ? OLD_ROOT : NEW_ROOT)
      )
      mockGetTypeHandler.mockImplementation(async () =>
        handlerAnswering('Wf', true)
      )
      const input = workflowsIn(NEW_ROOT).map(path => `A\t${path}`)
      const moved = workflowsIn(OLD_ROOT).map(path => deletion(path))
      const sut = newSut()

      // Act
      await sut.resolve(input, moved)

      // Assert
      expect(runUnion).toHaveBeenCalledTimes(count)
      expect(scans.get(FROM)).toBe(1)
      expect(scans.get(TO)).toBe(1)
    })
  })

  describe('Given a moved component absent from the --to listing', () => {
    it('When resolve runs, Then the additions are kept', async () => {
      // Arrange
      arrange({ from: sameBlobs.from, to: { [UNRELATED]: 'f6' } })
      const sut = newSut()

      // Act
      const result = await sut.resolve(lines, cancelled())

      // Assert
      expect(result.lines).toEqual(lines)
    })
  })

  describe('Given a move with unrelated ignore state', () => {
    it('When an unrelated file sits under the ignore file at --from, Then the move is still pure', async () => {
      // Arrange
      mockKeep.mockImplementation(line => !line.endsWith('Other.cls'))
      const sut = newSut()

      // Act
      const result = await sut.resolve(lines, cancelled())

      // Assert
      expect(result.lines).toEqual([lines[1], lines[3]])
    })

    it('When the destination sits under the destructive ignore only, Then the move is still pure', async () => {
      // Arrange
      mockKeep.mockImplementation(line => !line.startsWith('D'))
      const sut = newSut()

      // Act
      const result = await sut.resolve(lines, cancelled())

      // Assert
      expect(result.lines).toEqual([lines[1], lines[3]])
    })
  })

  describe('Given pure and kept moves', () => {
    it('When a pure class move and a kept move are judged, Then one debug line names ApexClass:Foo only', async () => {
      // Arrange
      const barOld = `${OLD_DIR}/Bar.cls`
      const barNew = `${NEW_DIR}/Bar.cls`
      arrange({
        from: { ...sameBlobs.from, [barOld]: 'c2' },
        to: { ...sameBlobs.to, [barNew]: 'ff' },
      })
      mockGetTypeHandler.mockImplementation(async (line: string) => ({
        getElementDescriptor: () => ({
          type: 'ApexClass',
          member: line.includes('Bar') ? 'Bar' : 'Foo',
        }),
        comparesElements: () => false,
      }))
      const sut = newSut()

      // Act
      await sut.resolve(
        [...lines, `A\t${barNew}`],
        [...cancelled(), deletion(barOld)]
      )

      // Assert
      const suppressed = debugMessages().filter(m => m.includes('suppressed'))
      expect(suppressed).toHaveLength(1)
      expect(suppressed[0]).toContain('ApexClass:Foo')
      expect(suppressed[0]).not.toContain('Bar')
    })

    it('When several moves are pure, Then one debug line names them sorted and comma separated', async () => {
      // Arrange
      const barOld = `${OLD_DIR}/Bar.cls`
      const barNew = `${NEW_DIR}/Bar.cls`
      arrange({
        from: { ...sameBlobs.from, [barOld]: 'c2' },
        to: { ...sameBlobs.to, [barNew]: 'c2' },
      })
      mockGetTypeHandler.mockImplementation(async (line: string) => ({
        getElementDescriptor: () => ({
          type: 'ApexClass',
          member: line.includes('Bar') ? 'Bar' : 'Foo',
        }),
        comparesElements: () => false,
      }))
      const sut = newSut()

      // Act
      await sut.resolve(
        [...lines, `A\t${barNew}`],
        [...cancelled(), deletion(barOld)]
      )

      // Assert
      expect(debugMessages()).toContain(
        'Pure move(s) suppressed: ApexClass:Bar, ApexClass:Foo'
      )
    })

    it('When no move is pure, Then no suppression line is logged', async () => {
      // Arrange
      arrange({ from: sameBlobs.from, to: { [NEW_CLS]: 'a1' } })
      const sut = newSut()

      // Act
      await sut.resolve(lines, cancelled())

      // Assert
      expect(debugMessages().filter(m => m.includes('suppressed'))).toEqual([])
    })
  })

  describe('Given a labels file moved', () => {
    const LABELS_OLD = 'force-app/a/labels/CustomLabels.labels-meta.xml'
    const LABELS_NEW = 'force-app/x/labels/CustomLabels.labels-meta.xml'
    const OTHER_OLD = 'force-app/b/labels/Other.labels-meta.xml'
    const OTHER_NEW = 'force-app/y/labels/Other.labels-meta.xml'
    const OUTSIDE_OLD = 'misc/a/labels/Other.labels-meta.xml'
    const OUTSIDE_NEW = 'misc/x/labels/Other.labels-meta.xml'
    const OUTCOME = {
      manifests: { added: [], modified: [], deleted: [] },
      hasPackageContent: false,
    } satisfies DiffOutcome

    const arrangeLabels = (layout: Layout, rootFile = PROJECT) => {
      arrange(layout, rootFile)
      mockGetTypeHandler.mockImplementation(async (line: string) =>
        line.includes('/classes/')
          ? handlerAnswering('Bar')
          : {
              getElementDescriptor: () => ({
                type: 'CustomLabel',
                member: line.includes('Other') ? 'Other' : 'CustomLabels',
              }),
              comparesElements: () => true,
            }
      )
    }

    const labelsMove: Layout = {
      from: { [LABELS_OLD]: 'a1' },
      to: { [LABELS_NEW]: 'a1' },
    }

    it('When the file moves inside one entry, Then runUnion receives one spec for that entry, the result carries its outcomes and no line is dropped', async () => {
      // Arrange
      arrangeLabels(labelsMove)
      runUnion.mockResolvedValue(new Map([[LABELS_NEW, OUTCOME]]))
      const labelLines = [`A\t${LABELS_NEW}`]
      const sut = newSut()

      // Act
      const result = await sut.resolve(labelLines, [deletion(LABELS_OLD)])

      // Assert
      expect(runUnion).toHaveBeenCalledTimes(1)
      expect(runUnion).toHaveBeenCalledWith(
        expect.objectContaining({
          additionBasePaths: [LABELS_OLD],
          deletionBasePaths: [LABELS_OLD],
          shieldPaths: [LABELS_NEW],
          memberPaths: [LABELS_NEW],
        })
      )
      expect(result.unions).toEqual(new Map([[LABELS_NEW, OUTCOME]]))
      expect(result.lines).toEqual(labelLines)
    })

    it('When the union diff succeeds, Then the debug line names the scope, the entry and the member count', async () => {
      // Arrange
      arrangeLabels(labelsMove)
      const sut = newSut()

      // Act
      await sut.resolve([`A\t${LABELS_NEW}`], [deletion(LABELS_OLD)])

      // Assert
      expect(debugMessages()).toContain(
        'Union diff of CustomLabels in force-app: 1 member(s)'
      )
    })

    it('When two labels keys land in one entry, Then one spec covers both', async () => {
      // Arrange
      arrangeLabels({
        from: { ...labelsMove.from, [OTHER_OLD]: 'b1' },
        to: { ...labelsMove.to, [OTHER_NEW]: 'b1' },
      })
      const sut = newSut()

      // Act
      await sut.resolve(
        [`A\t${LABELS_NEW}`, `A\t${OTHER_NEW}`],
        [deletion(LABELS_OLD), deletion(OTHER_OLD)]
      )

      // Assert
      expect(runUnion).toHaveBeenCalledTimes(1)
      expect(runUnion).toHaveBeenCalledWith(
        expect.objectContaining({
          additionBasePaths: [LABELS_OLD, OTHER_OLD],
          shieldPaths: [LABELS_NEW, OTHER_NEW],
        })
      )
    })

    it('When the source deletion sits under the ignore file, Then no spec is built', async () => {
      // Arrange
      arrangeLabels(labelsMove)
      mockKeep.mockImplementation(line => line !== `A\t${LABELS_OLD}`)
      const sut = newSut()

      // Act
      await sut.resolve([`A\t${LABELS_NEW}`], [deletion(LABELS_OLD)])

      // Assert
      expect(runUnion).not.toHaveBeenCalled()
    })

    it('When the deletion and the addition sit in different entries, Then no spec is built and the other pure group is still dropped', async () => {
      // Arrange
      const barOld = 'force-app/a/main/classes/Bar.cls'
      const barNew = 'force-app/a/second/classes/Bar.cls'
      arrangeLabels(
        {
          from: { ...labelsMove.from, [barOld]: 'c2' },
          to: { ...labelsMove.to, [barNew]: 'c2' },
        },
        JSON.stringify({
          packageDirectories: [
            { path: 'force-app/a' },
            { path: 'force-app/x' },
          ],
        })
      )
      const sut = newSut()

      // Act
      const result = await sut.resolve(
        [`A\t${LABELS_NEW}`, `A\t${barNew}`],
        [deletion(LABELS_OLD), deletion(barOld)]
      )

      // Assert
      expect(runUnion).not.toHaveBeenCalled()
      expect(result.lines).toEqual([`A\t${LABELS_NEW}`])
      expect(result.checkSkipped).toBe(false)
    })

    it('When one move is inside an entry and another outside every entry, Then two distinct specs are built', async () => {
      // Arrange
      arrangeLabels({
        from: { ...labelsMove.from, [OUTSIDE_OLD]: 'b1' },
        to: { ...labelsMove.to, [OUTSIDE_NEW]: 'b1' },
      })
      const sut = newSut()

      // Act
      await sut.resolve(
        [`A\t${LABELS_NEW}`, `A\t${OUTSIDE_NEW}`],
        [deletion(LABELS_OLD), deletion(OUTSIDE_OLD)]
      )

      // Assert
      expect(runUnion).toHaveBeenCalledTimes(2)
      const specs = runUnion.mock.calls.map(([spec]) => spec)
      expect(specs).toContainEqual(
        expect.objectContaining({ shieldPaths: [LABELS_NEW] })
      )
      expect(specs).toContainEqual(
        expect.objectContaining({ shieldPaths: [OUTSIDE_NEW] })
      )
    })

    it('When the files live outside their type directory, Then no spec is built and the other pure group is still dropped', async () => {
      // Arrange
      const stray = 'force-app/a/CustomLabels.labels-meta.xml'
      const strayMoved = 'force-app/x/CustomLabels.labels-meta.xml'
      arrangeLabels({
        from: { [stray]: 'a1', ...BAR_BLOBS.from },
        to: { [strayMoved]: 'a1', ...BAR_BLOBS.to },
      })
      const sut = newSut()

      // Act
      const result = await sut.resolve(
        [`A\t${strayMoved}`, `A\t${BAR_NEW}`],
        [deletion(stray), deletion(BAR_OLD)]
      )

      // Assert
      expect(runUnion).not.toHaveBeenCalled()
      expect(result.lines).toEqual([`A\t${strayMoved}`])
      expect(result.checkSkipped).toBe(false)
    })

    it('When a non-cancelled deletion targets a base file, Then that line is dropped from the lines', async () => {
      // Arrange
      arrangeLabels({
        from: { ...labelsMove.from, [OTHER_OLD]: 'b1' },
        to: labelsMove.to,
      })
      const stillDeleted = `D\t${OTHER_OLD}`
      const sut = newSut()

      // Act
      const result = await sut.resolve(
        [`A\t${LABELS_NEW}`, stillDeleted],
        [deletion(LABELS_OLD)]
      )

      // Assert
      expect(result.lines).toEqual([`A\t${LABELS_NEW}`])
    })

    it('When runUnion rejects, Then the entry has no outcome, its lines are kept and the cause is logged', async () => {
      // Arrange
      arrangeLabels(labelsMove)
      runUnion.mockRejectedValue(new Error('strict read failed'))
      const labelLines = [`A\t${LABELS_NEW}`, `D\t${OTHER_OLD}`]
      const sut = newSut()

      // Act
      const result = await sut.resolve(labelLines, [deletion(LABELS_OLD)])

      // Assert
      expect(result.unions.size).toBe(0)
      expect(result.lines).toEqual(labelLines)
      expect(result.checkSkipped).toBe(false)
      expect(debugMessages().join('\n')).toContain('strict read failed')
    })
  })
})
