'use strict'
const {
  copyFiles,
  readFile,
  scan,
  scanExtension,
  FSE_BIGINT_ERROR,
} = require('../../../../src/utils/fsHelper')
const fs = require('fs')
const fse = require('fs-extra')
const { sep } = require('path')

jest.mock('fs')
jest.mock('fs-extra')

describe('copyFile', () => {
  describe('when fse.copy throw "Source and destination must not be the same." special use cases', () => {
    beforeEach(() => {
      // Arrange
      fse.copy.mockImplementationOnce(() =>
        Promise.reject({
          message: FSE_BIGINT_ERROR,
        })
      )
    })

    it(`should call fse.copyFile`, async () => {
      // Act
      await copyFiles('repo/file', 'output/file')

      // Assert
      expect(fse.pathExists).toHaveBeenCalled()
      expect(fse.copySync).not.toHaveBeenCalled()
      expect(fs.promises.copyFile).toHaveBeenCalled()
      expect(fse.copy).toHaveBeenCalled()
    })
  })

  describe('when fse.copy throw', () => {
    beforeEach(() => {
      // Arrange
      fse.copy.mockImplementationOnce(() =>
        Promise.reject({
          message: 'other',
        })
      )
    })
    it(`should call fse.copySync`, async () => {
      // Act
      await copyFiles('other/file', 'output/file')

      // Assert
      expect(fse.pathExists).toHaveBeenCalled()
      expect(fse.copySync).toHaveBeenCalled()
      expect(fs.promises.copyFile).not.toHaveBeenCalled()
      expect(fse.copy).toHaveBeenCalled()
    })
  })

  describe('when pathExists returns false', () => {
    beforeEach(() => {
      // Arrange
      fse.pathExists.mockImplementationOnce(() => Promise.resolve(false))
    })
    it(`should not call fse.copy`, async () => {
      // Act
      await copyFiles('another/file', 'output/file')

      // Assert
      expect(fse.pathExists).toHaveBeenCalled()
      expect(fse.copySync).not.toHaveBeenCalled()
      expect(fs.promises.copyFile).not.toHaveBeenCalled()
      expect(fse.copy).not.toHaveBeenCalled()
    })
  })

  describe('when file has already been copied', () => {
    beforeEach(async () => {
      // Arrange
      await copyFiles('yetanother/file', 'output/file')
      fse.pathExists.mockClear()
      fse.copy.mockClear()
    })
    it(`should not call fse.pathExists`, async () => {
      // Act
      await copyFiles('yetanother/file', 'output/file')

      // Assert
      expect(fse.pathExists).not.toHaveBeenCalled()
      expect(fse.copySync).not.toHaveBeenCalled()
      expect(fs.promises.copyFile).not.toHaveBeenCalled()
      expect(fse.copy).not.toHaveBeenCalled()
    })
  })

  describe('when new file', () => {
    it(`should just call fse.copy`, async () => {
      // Act
      await copyFiles('new/file', 'output/file')

      // Assert
      expect(fse.pathExists).toHaveBeenCalled()
      expect(fse.copySync).not.toHaveBeenCalled()
      expect(fs.promises.copyFile).not.toHaveBeenCalled()
      expect(fse.copy).toHaveBeenCalled()
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
  describe('when readdir returns a directory', () => {
    const dir = {
      name: 'test',
      isDirectory: () => true,
    }
    beforeEach(() => {
      // Arrange
      fs.promises.readdir.mockImplementationOnce(() => Promise.resolve([dir]))
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
