'use strict'
import { describe, expect, it, vi } from 'vitest'
import { TreeIndex } from '../../../../src/adapter/treeIndex'
import { createTreeReader } from '../../../../src/adapter/treeReader'
import { DOT } from '../../../../src/constant/fsConstants'
import type {
  CopyOperation,
  GitTypeDirCompanionCopyOperation,
} from '../../../../src/types/handlerResult'
import { CopyOperationKind } from '../../../../src/types/handlerResult'
import { expandTypeDirCompanionCopies } from '../../../../src/utils/typeDirCompanionCopies'

const TO = 'to-revision'
const OTHER = 'other-revision'
const LWC = 'force-app/main/default/lwc'
const AURA = 'force-app/main/default/aura'
const GEN_AI = 'force-app/main/default/genAiFunctions'
const ESLINT_CONFIG = '.eslintrc.json'
const PRETTIER_CONFIG = '.prettierrc'
const JEST_CONFIG = 'jest.config.js'

const indexOf = (paths: string[]): TreeIndex => {
  const index = new TreeIndex()
  for (const path of paths) index.add(path)
  return index
}

const readerOf = (paths: string[], revision = TO) =>
  createTreeReader(new Map([[revision, indexOf(paths)]]))

const companionRequest = (
  path: string,
  revision = TO
): GitTypeDirCompanionCopyOperation => ({
  kind: CopyOperationKind.GitTypeDirCompanionCopy,
  path,
  revision,
})

const gitCopy = (path: string, revision = TO): CopyOperation => ({
  kind: CopyOperationKind.GitCopy,
  path,
  revision,
})

const expand = (paths: string[], dir = LWC) =>
  expandTypeDirCompanionCopies([companionRequest(dir)], readerOf(paths))

describe('expandTypeDirCompanionCopies', () => {
  describe('Given a companion request on a type directory holding only files', () => {
    it('When expanded, Then each file becomes one GitCopy at the request revision', () => {
      // Arrange
      const paths = [ESLINT_CONFIG, PRETTIER_CONFIG, JEST_CONFIG].map(
        name => `${LWC}/${name}`
      )

      // Act
      const result = expand(paths)

      // Assert
      expect(result).toEqual(paths.map(path => gitCopy(path)))
    })
  })

  describe('Given sibling bundles in the type directory', () => {
    it.each([
      [LWC, 'a', 'a.js-meta.xml'],
      [AURA, 'c', 'c.cmp-meta.xml'],
      [AURA, 'ev', 'ev.evt-meta.xml'],
      [AURA, 'ap', 'ap.app-meta.xml'],
      [AURA, 'itf', 'itf.intf-meta.xml'],
      [AURA, 'tok', 'tok.tokens-meta.xml'],
      [GEN_AI, 'fn', 'fn.genAiFunction-meta.xml'],
    ])(
      'When expanded in %s with bundle %s, Then none of its files is copied',
      (typeDir, bundle, metaFile) => {
        // Arrange
        const paths = [
          `${typeDir}/${ESLINT_CONFIG}`,
          `${typeDir}/${bundle}/${metaFile}`,
          `${typeDir}/${bundle}/${bundle}.js`,
        ]

        // Act
        const result = expand(paths, typeDir)

        // Assert
        expect(result).toEqual([gitCopy(`${typeDir}/${ESLINT_CONFIG}`)])
      }
    )
  })

  describe('Given a non-bundle folder with nested directories', () => {
    it('When expanded, Then the nested file is copied', () => {
      // Arrange
      const nested = `${LWC}/__mocks__/lightning/navigation.js`

      // Act
      const result = expand([nested])

      // Assert
      expect(result).toEqual([gitCopy(nested)])
    })
  })

  describe('Given a folder whose only meta file has another stem', () => {
    it('When expanded, Then its whole subtree is copied', () => {
      // Arrange
      const paths = [
        `${LWC}/utils/utils.js`,
        `${LWC}/utils/other.js-meta.xml`,
        `${LWC}/utils/nested/n.js`,
      ]

      // Act
      const result = expand(paths)

      // Assert
      expect(result).toHaveLength(paths.length)
      expect(result).toEqual(expect.arrayContaining(paths.map(p => gitCopy(p))))
    })
  })

  describe('Given a folder whose stem-matching entry is not a meta file', () => {
    it('When expanded, Then it is copied', () => {
      // Arrange
      const path = `${LWC}/x/x.txt`

      // Act
      const result = expand([path])

      // Assert
      expect(result).toEqual([gitCopy(path)])
    })
  })

  describe('Given a dotted folder name holding its own dotted meta', () => {
    it('When expanded, Then it is copied', () => {
      // Arrange
      const path = `${LWC}/a.b/a.b.js-meta.xml`

      // Act
      const result = expand([path])

      // Assert
      expect(result).toEqual([gitCopy(path)])
    })
  })

  describe('Given a folder holding no meta file at all', () => {
    it('When expanded, Then its subtree is copied', () => {
      // Arrange
      const path = `${LWC}/wip/wip.js`

      // Act
      const result = expand([path])

      // Assert
      expect(result).toEqual([gitCopy(path)])
    })
  })

  describe('Given a folder whose stem-matching meta name carries a trailing suffix', () => {
    it('When expanded, Then it is a bundle as for SDR and nothing is copied', () => {
      // Arrange
      const path = `${LWC}/a/a.js-meta.xml.bak`

      // Act
      const result = expand([path])

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('Given folder entries at the edges of SDR root-metadata matching', () => {
    it.each([
      ['a one-character extension', 'a.j-meta.xml'],
      ['a matching first line followed by another line', 'a.j-meta.xml\nz'],
    ])(
      'When the entry has %s, Then it is a bundle and nothing is copied',
      (_title, name) => {
        // Arrange
        const path = `${LWC}/a/${name}`

        // Act
        const result = expand([path])

        // Assert
        expect(result).toEqual([])
      }
    )

    it.each([
      ['no character between the dot and the meta suffix', 'a.-meta.xml'],
      ['a later line that starts with the dot', 'a.z\n.x-meta.xml'],
    ])(
      'When the entry has %s, Then it is not a bundle and the folder is copied',
      (_title, name) => {
        // Arrange
        const path = `${LWC}/a/${name}`

        // Act
        const result = expand([path])

        // Assert
        expect(result).toEqual([gitCopy(path)])
      }
    )
  })

  describe('Given a folder entry whose name is a long run of dots after the stem', () => {
    it('When expanded, Then the bundle check stays linear and the folder is copied', () => {
      // Arrange
      const ADVERSARIAL_DOTS = 4000
      const path = `${LWC}/a/a${DOT.repeat(ADVERSARIAL_DOTS)}`

      // Act
      const result = expand([path])

      // Assert
      expect(result).toEqual([gitCopy(path)])
    })
  })

  describe('Given a folder entry whose meta suffix sits after a line break', () => {
    it('When expanded, Then it is not a bundle as for SDR and the folder is copied', () => {
      // Arrange
      const path = `${LWC}/a/a.x\n-meta.xml`

      // Act
      const result = expand([path])

      // Assert
      expect(result).toEqual([gitCopy(path)])
    })
  })

  describe('Given an unindexed revision or a missing type directory', () => {
    it.each([
      ['an unindexed revision', [companionRequest(LWC, OTHER)]],
      ['a missing type directory', [companionRequest(AURA)]],
    ])('When expanded with %s, Then nothing is produced', (_title, copies) => {
      // Arrange
      const trees = readerOf([`${LWC}/${ESLINT_CONFIG}`])

      // Act
      const result = expandTypeDirCompanionCopies(copies, trees)

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('Given identical companion requests', () => {
    it('When expanded, Then the type directory is listed once and the copies sit at the first request position', () => {
      // Arrange
      const trees = readerOf([
        `${LWC}/${ESLINT_CONFIG}`,
        `${LWC}/a/a.js-meta.xml`,
      ])
      const spy = vi.spyOn(trees, 'children')
      const copies = [
        gitCopy('x'),
        companionRequest(LWC),
        gitCopy('y'),
        companionRequest(LWC),
      ]

      // Act
      const result = expandTypeDirCompanionCopies(copies, trees)

      // Assert
      expect(result).toEqual([
        gitCopy('x'),
        gitCopy(`${LWC}/${ESLINT_CONFIG}`),
        gitCopy('y'),
      ])
      expect(spy.mock.calls.filter(([, dir]) => dir === LWC)).toHaveLength(1)
    })
  })

  describe('Given requests differing by revision or by directory', () => {
    it.each<[string, CopyOperation[], CopyOperation[]]>([
      [
        'two revisions for one directory',
        [companionRequest(LWC, TO), companionRequest(LWC, OTHER)],
        [gitCopy(`${LWC}/f`, TO), gitCopy(`${LWC}/f`, OTHER)],
      ],
      [
        'two directories at one revision',
        [companionRequest(LWC), companionRequest(AURA)],
        [gitCopy(`${LWC}/f`), gitCopy(`${AURA}/g`)],
      ],
    ])(
      'When expanded with %s, Then each request is expanded on its own',
      (_title, copies, expected) => {
        // Arrange
        const trees = createTreeReader(
          new Map([
            [TO, indexOf([`${LWC}/f`, `${AURA}/g`])],
            [OTHER, indexOf([`${LWC}/f`, `${AURA}/g`])],
          ])
        )

        // Act
        const result = expandTypeDirCompanionCopies(copies, trees)

        // Assert
        expect(result).toEqual(expected)
      }
    )
  })

  describe('Given requests interleaved with other operations', () => {
    it('When expanded, Then the other operations pass through unchanged and in order', () => {
      // Arrange
      const trees = readerOf([`${LWC}/${ESLINT_CONFIG}`])
      const component: CopyOperation = {
        kind: CopyOperationKind.GitComponentCopy,
        path: 'c',
        revision: TO,
      }
      const streamed: CopyOperation = {
        kind: CopyOperationKind.StreamedContent,
        path: 'z',
        writer: vi.fn().mockResolvedValue(undefined),
      }
      const copies = [gitCopy('x'), companionRequest(LWC), component, streamed]

      // Act
      const result = expandTypeDirCompanionCopies(copies, trees)

      // Assert
      expect(result).toEqual([
        gitCopy('x'),
        gitCopy(`${LWC}/${ESLINT_CONFIG}`),
        component,
        streamed,
      ])
      expect(result[3]).toBe(streamed)
    })
  })
})
