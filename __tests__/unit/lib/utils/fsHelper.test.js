'use strict'
const {
  copyFiles,
  gitPathSeparatorNormalizer,
  isSubDir,
  pathExists,
  readDir,
  readFile,
  readPathFromGit,
  scan,
  scanExtension,
  writeFile,
} = require('../../../../src/utils/fsHelper')
const {
  getStreamContent,
  treatPathSep,
} = require('../../../../src/utils/childProcessUtils')
const { spawn } = require('child_process')
const fs = require('fs')
const { outputFile } = require('fs-extra')
const { EOL } = require('os')

jest.mock('fs')
jest.mock('fs-extra')
jest.mock('child_process')

jest.mock('../../../../src/utils/childProcessUtils', () => {
  const originalModule = jest.requireActual(
    '../../../../src/utils/childProcessUtils'
  )

  return {
    ...originalModule,
    getStreamContent: jest.fn(() => Promise.resolve(Buffer.from(''))),
    treatPathSep: jest.fn(() => ''),
  }
})

let work
beforeEach(() => {
  work = {
    config: {
      output: '.',
      source: '',
      repo: '',
      generateDelta: false,
      from: 'pastsha',
      to: 'recentsha',
    },
    warnings: [],
  }
})

describe('gitPathSeparatorNormalizer', () => {
  it('replaces every instance of \\', async () => {
    // Arrange
    const windowsPath = 'path\\to\\a\\\\file'

    // Act
    const result = gitPathSeparatorNormalizer(windowsPath)

    // Assert
    expect(result).toEqual('path/to/a/file')
  })

  describe.each([undefined, null])('when called with %s', falsy => {
    it('return null', () => {
      // Act
      const result = gitPathSeparatorNormalizer(falsy)

      // Assert
      expect(result).toBeUndefined()
    })
  })
})

describe('readPathFromGit', () => {
  describe.each([
    ['windows', 'force-app\\main\\default\\classes\\myClass.cls'],
    ['unix', 'force-app/main/default/classes/myClass.cls'],
  ])('when path is %s format', (_, path) => {
    beforeEach(() => {
      // Arrange
      getStreamContent.mockImplementation(() =>
        Promise.resolve(Buffer.from(''))
      )
    })

    it('should use "config.to" and "normalized path" to get git history', async () => {
      // Act
      await readPathFromGit(path, work.config)

      // Assert
      const normalizedPath = path.replace(/\\+/g, '/')
      expect(spawn).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining([`${work.config.to}:${normalizedPath}`]),
        expect.anything()
      )
      expect(getStreamContent).toBeCalled()
    })
  })
})

describe('copyFile', () => {
  describe('when file is already copied', () => {
    it('should not copy file', async () => {
      await copyFiles(work.config, 'source/file')
      jest.resetAllMocks()

      // Act
      await copyFiles(work.config, 'source/file')

      // Assert
      expect(spawn).not.toBeCalled()
      expect(getStreamContent).not.toBeCalled()
      expect(outputFile).not.toBeCalled()
    })
  })

  describe('when source location is empty', () => {
    it('should copy file', async () => {
      // Arrange
      treatPathSep.mockImplementationOnce(() => 'output/source/copyFile')
      getStreamContent.mockImplementation(() =>
        Promise.resolve(Buffer.from(''))
      )

      // Act
      await copyFiles(work.config, 'source/doNotCopy')

      // Assert
      expect(spawn).toBeCalled()
      expect(getStreamContent).toBeCalled()
      expect(outputFile).toBeCalledWith(
        'output/source/copyFile',
        Buffer.from('')
      )
    })
  })

  describe('when source location is not empty', () => {
    describe('when content is a folder', () => {
      it('should copy the folder', async () => {
        // Arrange
        treatPathSep.mockImplementationOnce(() => 'output/copyDir/copyFile')
        getStreamContent.mockImplementationOnce(() =>
          Promise.resolve(Buffer.from('tree HEAD:folder\n\ncopyFile'))
        )
        getStreamContent.mockImplementation(() =>
          Promise.resolve(Buffer.from('content'))
        )

        // Act
        await copyFiles(work.config, 'source/copyDir')

        // Assert
        expect(spawn).toBeCalledTimes(2)
        expect(getStreamContent).toBeCalledTimes(2)
        expect(outputFile).toBeCalledTimes(1)
        expect(outputFile).toHaveBeenCalledWith(
          'output/copyDir/copyFile',
          Buffer.from('content')
        )
        expect(treatPathSep).toBeCalledTimes(1)
      })
    })
    describe('when content is not a git location', () => {
      it('should ignore this path', async () => {
        // Arrange
        const sourcePath = 'source/warning'
        getStreamContent.mockImplementation(() =>
          Promise.reject(`fatal: path '${sourcePath}' does not exist in 'HEAD'`)
        )

        // Act
        await copyFiles(work.config, sourcePath)

        // Assert
        expect(spawn).toBeCalled()
        expect(getStreamContent).toBeCalled()
        expect(outputFile).not.toBeCalled()
      })
    })
    describe('when content is a file', () => {
      beforeEach(async () => {
        // Arrange
        getStreamContent.mockImplementation(() =>
          Promise.resolve(Buffer.from('content'))
        )
        treatPathSep.mockImplementationOnce(() => 'output/source/copyFile')
      })
      it('should copy the file', async () => {
        // Act
        await copyFiles(work.config, 'source/copyfile')

        // Assert
        expect(spawn).toBeCalled()
        expect(getStreamContent).toBeCalled()
        expect(outputFile).toBeCalledTimes(1)
        expect(outputFile).toHaveBeenCalledWith(
          'output/source/copyFile',
          Buffer.from('content')
        )
        expect(treatPathSep).toBeCalledTimes(1)
      })
    })
  })
})

describe('readDir', () => {
  describe('when getStreamContent succeed', () => {
    const dir = 'dir/'
    const file = 'test.js'
    beforeEach(() => {
      // Arrange
      getStreamContent.mockImplementation(() =>
        Promise.resolve(Buffer.from([`tree HEAD:${dir}`, '', file].join(EOL)))
      )
    })
    it('should return the file', async () => {
      // Act
      const dirContent = await readDir(dir, work)

      // Assert
      expect(dirContent).toEqual(expect.arrayContaining([`${file}`]))
      expect(getStreamContent).toHaveBeenCalled()
    })
  })

  describe('when getStreamContent throw', () => {
    beforeEach(() => {
      // Arrange
      getStreamContent.mockImplementation(() =>
        Promise.reject(new Error('mock'))
      )
    })
    it('should throw', async () => {
      // Act
      try {
        await readFile('path', work)
      } catch (err) {
        // Assert
        expect(err).toBeTruthy()
        expect(getStreamContent).toHaveBeenCalled()
      }
    })
  })
})

describe('readFile', () => {
  describe('when readfile succeed', () => {
    beforeEach(() => {
      // Arrange
      fs.promises.readFile.mockImplementationOnce(() => Promise.resolve({}))
    })
    it('should return the file', async () => {
      // Act
      const file = await readFile('path')

      // Assert
      expect(file).toBeTruthy()
      expect(fs.promises.readFile).toHaveBeenCalled()
    })
  })

  describe('when readfile throw', () => {
    beforeEach(() => {
      // Arrange
      fs.promises.readFile.mockImplementationOnce(() => Promise.reject('Error'))
    })
    it('should throw', async () => {
      // Act
      try {
        await readFile('path')
      } catch (err) {
        // Assert
        expect(err).toBeTruthy()
        expect(fs.promises.readFile).toHaveBeenCalled()
      }
    })
  })
})
describe('scan', () => {
  describe('when getStreamContent throw', () => {
    beforeEach(() => {
      // Arrange
      getStreamContent.mockImplementation(() =>
        Promise.reject(new Error('mock'))
      )
    })
    it('should throw', async () => {
      // Arrange
      expect.assertions(1)
      const g = scan('dir', work)

      // Assert
      expect(g.next()).rejects.toEqual(new Error('mock'))
    })
  })
  describe('when getStreamContent returns nothing', () => {
    beforeEach(() => {
      // Arrange
      getStreamContent.mockImplementation(() =>
        Promise.resolve(Buffer.from(''))
      )
    })
    it('should return nothing', async () => {
      // Arrange
      const g = scan('dir', work)
      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toBeFalsy()
    })
  })
  describe('when getStreamContent returns a file', () => {
    const dir = 'dir/'
    const file = 'test.js'
    beforeEach(() => {
      // Arrange
      getStreamContent.mockImplementation(() =>
        Promise.resolve(Buffer.from([`tree HEAD:${dir}`, '', file].join(EOL)))
      )
    })
    it('should return a file', async () => {
      // Arrange
      const g = scan(dir, work)
      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toEqual(`${dir}${file}`)
    })
  })
  describe('when getStreamContent returns an empty directory', () => {
    const dir = 'dir/'
    const subDir = 'subDir/'
    it('should return nothing', async () => {
      // Arrange
      getStreamContent.mockImplementationOnce(() =>
        Promise.resolve(Buffer.from([`tree HEAD:${dir}`, '', subDir].join(EOL)))
      )
      getStreamContent.mockImplementation(() =>
        Promise.resolve(Buffer.from([`tree HEAD:${dir}${subDir}`].join(EOL)))
      )
      const g = scan('dir', work)

      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toBeFalsy()
    })
  })
  describe('when getStreamContent returns a directory with a file', () => {
    const dir = 'dir/'
    const subDir = 'subDir/'
    const subFile = 'test.js'
    beforeEach(() => {
      // Arrange
      getStreamContent.mockImplementationOnce(() =>
        Promise.resolve(Buffer.from([`tree HEAD:${dir}`, '', subDir].join(EOL)))
      )
      getStreamContent.mockImplementation(() =>
        Promise.resolve(
          Buffer.from([`tree HEAD:${dir}${subDir}`, '', subFile].join(EOL))
        )
      )
    })
    it('should return a file', async () => {
      // Arrange
      const g = scan('dir', work)
      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toBe(`${dir}${subDir}${subFile}`)
    })
  })
})
describe('scanExtension', () => {
  describe('when directory does not contains a file with the extension', () => {
    const dir = 'dir/'
    const file = 'test.js'
    beforeEach(() => {
      // Arrange
      getStreamContent.mockImplementation(() =>
        Promise.resolve(Buffer.from([`tree HEAD:${dir}`, '', file].join(EOL)))
      )
    })
    it('should return', async () => {
      // Arrange
      const g = scanExtension(dir, 'txt', work)
      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toBeFalsy()
    })
  })

  describe('when directory contains a file with the extension', () => {
    const dir = 'dir/'
    const file = 'test.js'
    beforeEach(() => {
      // Arrange
      getStreamContent.mockImplementation(() =>
        Promise.resolve(Buffer.from([`tree HEAD:${dir}`, '', file].join(EOL)))
      )
    })
    it('should return a file', async () => {
      // Arrange
      const g = scanExtension(dir, 'js', work)
      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toBe(`${dir}${file}`)
    })
  })
})

describe('isSubDir', () => {
  describe('when parent contains dir', () => {
    it('returns true', async () => {
      // Arrange

      // Act
      const result = isSubDir('parent', 'parent/dir')

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('when parent does not contains dir', () => {
    it('returns false', async () => {
      // Arrange

      // Act
      const result = isSubDir('parent', 'dir/child')

      // Assert
      expect(result).toBe(false)
    })
  })
  it.each([
    ['/foo', '/foo', false],
    ['/foo', '/bar', false],
    ['/foo', '/foobar', false],
    ['/foo', '/foo/bar', true],
    ['/foo', '/foo/../bar', false],
    ['/foo', '/foo/./bar', true],
    ['/bar/../foo', '/foo/bar', true],
    ['/foo', './bar', false],
    ['C:\\Foo', 'C:\\Foo\\Bar', false],
    ['C:\\Foo', 'C:\\Bar', false],
    ['C:\\Foo', 'D:\\Foo\\Bar', false],
  ])(
    `should verify %s expect %s to be a subDir: %s`,
    (parent, child, expected) => {
      // Arrange

      // Act
      const actual = isSubDir(parent, child)

      // Assert
      expect(actual).toBe(expected)
    }
  )

  describe('pathExists', () => {
    it('returns true when path is folder', async () => {
      // Arrange
      getStreamContent.mockImplementationOnce(() =>
        Promise.resolve(Buffer.from('tree path\n\nfolder'))
      )

      // Act
      const result = await pathExists('path', work.config)

      // Assert
      expect(result).toBe(true)
    })
    it('returns true when path is file', async () => {
      // Arrange
      getStreamContent.mockImplementationOnce(() =>
        Promise.resolve(Buffer.from('{"attribut":"content"}'))
      )

      // Act
      const result = await pathExists('path', work.config)

      // Assert
      expect(result).toBe(true)
    })
    it('returns false when path does not exist', async () => {
      // Arrange
      getStreamContent.mockImplementationOnce(() =>
        Promise.resolve(Buffer.from(''))
      )

      // Act
      const result = await pathExists('path', work.config)

      // Assert
      expect(result).toBe(false)
    })
    it('throws when spawn throws', async () => {
      expect.assertions(1)
      // Arrange
      getStreamContent.mockImplementationOnce(() =>
        Promise.reject(new Error('spawn issue'))
      )

      // Act
      try {
        await pathExists('path', work.config)
        // Assert
      } catch (error) {
        expect(error.message).toBe('spawn issue')
      }
    })
  })

  describe('writeFile', () => {
    beforeEach(() => {
      treatPathSep.mockReturnValueOnce('folder/file')
    })

    it.each(['folder/file', 'folder\\file'])(
      'write the content to the file system',
      async path => {
        // Arrange
        const output = 'root'
        const content = 'content'

        // Act
        await writeFile(path, content, { output })

        // Assert
        expect(outputFile).toHaveBeenCalledWith('root/folder/file', content)
      }
    )
  })
})
