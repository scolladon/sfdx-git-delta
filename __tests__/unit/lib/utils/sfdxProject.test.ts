import { describe, expect, it, vi } from 'vitest'

import { SgdError } from '../../../../src/utils/errorUtils'
import {
  loadSfdxProject,
  normalisePackageDirectory,
  SFDX_PROJECT_FILE,
  SfdxProject,
  SfdxProjectError,
} from '../../../../src/utils/sfdxProject'

const projectWith = (...paths: string[]) =>
  SfdxProject.parse(
    JSON.stringify({ packageDirectories: paths.map(path => ({ path })) })
  )

describe('Given normalisePackageDirectory', () => {
  it.each([
    ['./force-app/', 'force-app'],
    ['force-app/', 'force-app'],
    ['force-app\\sub', 'force-app/sub'],
    ['force-app//sub/./x', 'force-app/sub/x'],
    ['.', ''],
    ['./', ''],
    ['../x', '../x'],
  ])('When the raw path is %s, Then it normalises to %s', (raw, expected) => {
    // Arrange & Act
    const result = normalisePackageDirectory(raw)

    // Assert
    expect(result).toBe(expected)
  })
})

describe('Given SfdxProject.packageDirectoryOf', () => {
  it.each([
    ['force-app/billing/x', 'force-app/billing'],
    ['force-app/main/x', 'force-app'],
    ['force-app', 'force-app'],
    ['force-app2/x', null],
  ])(
    'When nested entries exist and the path is %s, Then the key is %s',
    (path, expected) => {
      // Arrange
      const sut = projectWith('force-app', 'force-app/billing')

      // Act
      const result = sut.packageDirectoryOf(path)

      // Assert
      expect(result).toBe(expected)
    }
  )

  it('When two entries share a path, Then they resolve to one key', () => {
    // Arrange
    const sut = SfdxProject.parse(
      JSON.stringify({
        packageDirectories: [
          { path: 'force-app', package: 'a' },
          { path: './force-app/', package: 'b' },
        ],
      })
    )

    // Act
    const result = sut.packageDirectoryOf('force-app/x')

    // Assert
    expect(result).toBe('force-app')
  })

  it('When the root entry exists, Then every path resolves to the empty key', () => {
    // Arrange
    const sut = projectWith('.')

    // Act
    const result = sut.packageDirectoryOf('anything/x')

    // Assert
    expect(result).toBe('')
  })

  it('When the root entry and a nested entry exist, Then the nested one wins inside it', () => {
    // Arrange
    const sut = projectWith('.', 'force-app')

    // Act
    const result = sut.packageDirectoryOf('force-app/x')

    // Assert
    expect(result).toBe('force-app')
  })

  it('When an entry points outside the repository, Then it matches nothing', () => {
    // Arrange
    const sut = projectWith('../x')

    // Act
    const result = sut.packageDirectoryOf('x/y')

    // Assert
    expect(result).toBeNull()
  })

  it.each([
    ['missing packageDirectories', '{}'],
    ['empty packageDirectories', '{"packageDirectories":[]}'],
  ])('When the project has %s, Then no path is inside', (_, json) => {
    // Arrange
    const sut = SfdxProject.parse(json)

    // Act
    const result = sut.packageDirectoryOf('force-app/x')

    // Assert
    expect(result).toBeNull()
  })
})

describe('Given SfdxProject.parse', () => {
  it('When the json is invalid, Then it throws an SfdxProjectError', () => {
    // Arrange & Act & Assert
    expect(() => SfdxProject.parse('{nope')).toThrow(SfdxProjectError)
  })

  it('When packageDirectories has a non string path, Then it throws an SfdxProjectError', () => {
    // Arrange & Act & Assert
    expect(() =>
      SfdxProject.parse('{"packageDirectories":[{"path":3}]}')
    ).toThrow(SfdxProjectError)
  })

  it('When the json is invalid, Then the error is named, says which file is invalid and keeps its cause', () => {
    // Arrange & Act & Assert
    expect(() => SfdxProject.parse('{nope')).toThrow(
      expect.objectContaining({
        name: 'SfdxProjectError',
        message: expect.stringMatching(/^Invalid sfdx-project\.json: .+/),
        cause: expect.any(SyntaxError),
      })
    )
  })

  it('When the error is raised, Then it is an SgdError', () => {
    // Arrange & Act & Assert
    expect(() => SfdxProject.parse('[')).toThrow(SgdError)
  })

  it.each([
    ['{"sourceApiVersion":"62.0"}', '62.0'],
    ['{"sourceApiVersion":62}', 62],
    ['{}', undefined],
  ])(
    'When the json is %s, Then sourceApiVersion is %s raw',
    (json, expected) => {
      // Arrange
      const sut = SfdxProject.parse(json)

      // Act
      const result = sut.sourceApiVersion

      // Assert
      expect(result).toBe(expected)
    }
  )
})

describe('Given loadSfdxProject', () => {
  it('When the file is absent, Then it resolves the absent project', async () => {
    // Arrange
    const reader = { getRootFileContent: vi.fn().mockResolvedValue(undefined) }

    // Act
    const result = await loadSfdxProject(reader, 'HEAD')

    // Assert
    expect(result).toBe(SfdxProject.ABSENT)
    expect(result.packageDirectoryOf('force-app/x')).toBeNull()
    expect(result.sourceApiVersion).toBeUndefined()
  })

  it('When the file holds json, Then it resolves the parsed project', async () => {
    // Arrange
    const reader = {
      getRootFileContent: vi
        .fn()
        .mockResolvedValue('{"sourceApiVersion":"62.0"}'),
    }

    // Act
    const result = await loadSfdxProject(reader, 'HEAD')

    // Assert
    expect(result.sourceApiVersion).toBe('62.0')
    expect(reader.getRootFileContent).toHaveBeenCalledWith(
      'HEAD',
      SFDX_PROJECT_FILE
    )
  })

  it('When the reader rejects, Then it rejects with the same error', async () => {
    // Arrange
    const error = new Error('boom')
    const reader = { getRootFileContent: vi.fn().mockRejectedValue(error) }

    // Act & Assert
    await expect(loadSfdxProject(reader, 'HEAD')).rejects.toBe(error)
  })
})
