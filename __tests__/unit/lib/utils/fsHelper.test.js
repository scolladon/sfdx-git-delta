'use strict'
const {
  copyFiles,
  isSubDir,
  readFile,
  scan,
  scanExtension,
} = require('../../../../src/utils/fsHelper')
const { getStreamContent } = require('../../../../src/utils/childProcessUtils')
const { spawn } = require('child_process')
const fs = require('fs')
const { outputFile } = require('fs-extra')
const { sep } = require('path')

jest.mock('../../../../src/utils/childProcessUtils')
jest.mock('fs')
jest.mock('fs-extra')
jest.mock('child_process')

jest.mock('../../../../src/utils/childProcessUtils', () => {
  const originalModule = jest.requireActual(
    '../../../../src/utils/childProcessUtils'
  )

  //Mock the default export and named export 'foo'
  return {
    ...originalModule,
    getStreamContent: jest.fn(),
  }
})

describe('copyFile', () => {
  let work
  beforeEach(() => {
    //jest.clearAllMocks()
    work = {
      config: { output: '', source: '', repo: '', generateDelta: false },
      warnings: [],
    }
  })
  describe('when file is already copied', () => {
    it('should not copy file', async () => {
      // Arrange
      await copyFiles(work, 'source/file', 'output/file')
      jest.resetAllMocks()

      // Act
      await copyFiles(work, 'source/file', 'output/file')

      // Assert
      expect(spawn).not.toBeCalled()
      expect(getStreamContent).not.toBeCalled()
      expect(outputFile).not.toBeCalled()
    })
  })

  describe('when source location is empty', () => {
    it('should not copy file', async () => {
      // Arrange
      getStreamContent.mockImplementation(() => '')

      // Act
      await copyFiles(work, 'source/doNotCopy', 'output/doNotCopy')

      // Assert
      expect(spawn).toBeCalled()
      expect(getStreamContent).toBeCalled()
      expect(outputFile).not.toBeCalled()
    })
  })

  describe('when source location is not empty', () => {
    describe('when content is a folder', () => {
      it('should copy the folder', async () => {
        // Arrange
        getStreamContent.mockImplementationOnce(
          () => 'tree HEAD:folder\n\ncopyFile'
        )
        getStreamContent.mockImplementationOnce(() => 'content')

        // Act
        await copyFiles(work, 'source/copyDir', 'output/copyDir')

        // Assert
        expect(spawn).toBeCalledTimes(2)
        expect(getStreamContent).toBeCalledTimes(2)
        expect(outputFile).toBeCalledTimes(1)
      })
    })
    describe('when content is not a git location', () => {
      it('should log a warning', async () => {
        // Arrange
        getStreamContent.mockImplementation(() => 'fatal')

        // Act
        await copyFiles(work, 'source/warning', 'output/warning')

        // Assert
        expect(spawn).toBeCalled()
        expect(getStreamContent).toBeCalled()
        expect(outputFile).not.toBeCalled()
        expect(work.warnings.length).toBe(1)
      })
    })
    describe('when content is a file', () => {
      beforeEach(async () => {
        // Arrange
        getStreamContent.mockImplementation(() => 'content')
      })
      it('should copy the file', async () => {
        // Act
        await copyFiles(work, 'source/copyfile', 'output/copyfile')

        // Assert
        expect(spawn).toBeCalled()
        expect(getStreamContent).toBeCalled()
        expect(outputFile).toBeCalledTimes(1)
      })
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
  describe('when readdir throw', () => {
    beforeEach(() => {
      // Arrange
      fs.promises.readdir.mockImplementationOnce(() => Promise.reject())
    })
    it('should throw', async () => {
      // Arrange
      expect.assertions(1)
      const g = scan('dir')

      // Assert
      expect(g.next()).rejects.toEqual()
    })
  })
  describe('when readdir returns nothing', () => {
    beforeEach(() => {
      // Arrange
      fs.promises.readdir.mockImplementationOnce(() => Promise.resolve([]))
    })
    it('should return nothing', async () => {
      // Arrange
      const g = scan('dir')
      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toBeFalsy()
    })
  })
  describe('when readdir returns a file', () => {
    const dir = 'dir'
    const file = {
      name: 'test',
      isDirectory: () => false,
    }
    beforeEach(() => {
      // Arrange
      fs.promises.readdir.mockImplementationOnce(() => Promise.resolve([file]))
    })
    it('should return a file', async () => {
      // Arrange
      const g = scan('dir')
      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toEqual(`${dir}${sep}${file.name}`)
    })
  })
  describe('when readdir returns an empty directory', () => {
    it('should return nothing', async () => {
      // Arrange
      const dir = {
        name: 'test',
        isDirectory: () => true,
      }
      fs.promises.readdir.mockImplementationOnce(() => Promise.resolve([dir]))
      fs.promises.readdir.mockImplementationOnce(() => Promise.resolve([]))
      const g = scan('dir')

      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toBeFalsy()
    })
  })
  describe('when readdir returns a directory with a file', () => {
    const dir = {
      name: 'test',
      isDirectory: () => true,
    }
    const file = {
      name: 'test',
      isDirectory: () => false,
    }
    beforeEach(() => {
      // Arrange
      fs.promises.readdir.mockImplementationOnce(() => Promise.resolve([dir]))

      fs.promises.readdir.mockImplementationOnce(() => Promise.resolve([file]))
    })
    it('should return a file', async () => {
      // Arrange
      const g = scan('dir')
      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toBe('dir/test/test')
    })
  })
})
describe('scanExtension', () => {
  describe('when directory does not contains a file with the extension', () => {
    const file = {
      name: 'test',
      isDirectory: () => false,
    }
    beforeEach(() => {
      // Arrange
      fs.promises.readdir.mockImplementationOnce(() => Promise.resolve([file]))
    })
    it('should return', async () => {
      // Arrange
      const g = scanExtension('dir', 'txt')
      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toBeFalsy()
    })
  })

  describe('when directory contains a file with the extension', () => {
    const file = {
      name: 'test.txt',
      isDirectory: () => false,
    }
    beforeEach(() => {
      // Arrange
      fs.promises.readdir.mockImplementationOnce(() => Promise.resolve([file]))
    })
    it('should return a file', async () => {
      // Arrange
      const g = scanExtension('dir', 'txt')
      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toBe('dir/test.txt')
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
})
