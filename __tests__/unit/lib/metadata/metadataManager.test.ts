'use strict'
import { expect, describe, it } from '@jest/globals'

import {
  getDefinition,
  getLatestSupportedVersion,
  isVersionSupported,
} from '../../../../src/metadata/metadataManager'

describe(`test if metadata`, () => {
  it('provide latest when apiVersion does not exist', async () => {
    const metadata = await getDefinition(0)
    const latestVersionSupported = await getLatestSupportedVersion()
    const latestMetadataDef = await getDefinition(latestVersionSupported)

    expect(metadata).toBeDefined()
    expect(metadata).toEqual(latestMetadataDef)
    expect(latestMetadataDef.get('classes')).toBeDefined()
    expect(latestMetadataDef.get('do not exist')).toBeUndefined()
  })

  it('has classes', async () => {
    const metadata = await getDefinition(58)
    expect(metadata.get('classes')).toBeDefined()
  })

  it('do not have do not exist', async () => {
    let metadata = await getDefinition(48)
    metadata = await getDefinition(46)
    expect(metadata).toBeDefined()
    expect(metadata.get('do not exist')).toBeFalsy()
  })

  it('getLatestSupportedVersion', async () => {
    const latestVersion = await getLatestSupportedVersion()
    expect(latestVersion).toBeDefined()
    expect(latestVersion).toEqual(expect.any(Number))
  })

  it('latest supported version is the second last version', async () => {
    // Arrange
    let i = 45

    // Act(s)
    while (await isVersionSupported(++i));
    // Here latest version should not be supported because it is equal to last version + 1

    // Assert
    const defaultLatestSupportedVersion = await getLatestSupportedVersion()
    // defaultLatestSupportedVersion should be equal to i + 1 (latest) + 1 (iteration)
    expect(i).toBe(defaultLatestSupportedVersion + 2)
  })

  it('isVersionSupported', async () => {
    // Arrange
    const dataSet = [
      [40, false],
      [46, true],
      [52, true],
      [55, true],
    ]

    // Act & Assert
    for (const data of dataSet) {
      const result = await isVersionSupported(data[0] as number)
      expect(result).toEqual(data[1])
    }
  })
})
