'use strict'
const {
  getDefinition,
  getInFileAttributs,
  getLatestSupportedVersion,
  isVersionSupported,
} = require('../../../../src/metadata/metadataManager')

describe(`test if metadata`, () => {
  test('when grouped per directoryName, have classes', async () => {
    const metadata = await getDefinition('directoryName')
    expect(metadata.get('classes')).toBeDefined()
  })

  test('when grouped per directoryName, do not have do not exist', async () => {
    let metadata = await getDefinition('directoryName', '48')
    metadata = await getDefinition('directoryName', '46')
    expect(metadata).toBeDefined()
    expect(metadata.get('do not exist')).toBeFalsy()
  })

  test('getLatestSupportedVersion', async () => {
    let latestVersion = await getLatestSupportedVersion()
    expect(latestVersion).toBeDefined()
    expect(latestVersion).toEqual(expect.any(Number))
  })

  test('isVersionSupported', async () => {
    // Arrange
    const dataSet = [
      [40, false],
      [46, true],
      [52, true],
      [55, true],
    ]

    // Act & Assert
    for (const data of dataSet) {
      const result = await isVersionSupported(data[0])
      expect(result).toEqual(data[1])
    }
  })

  test('getInFileAttributs', async () => {
    // Arrange
    const metadata = new Map([
      [
        'waveTemplates',
        {
          directoryName: 'waveTemplates',
          inFolder: true,
          metaFile: false,
          xmlName: 'WaveTemplateBundle',
        },
      ],
      [
        'alerts',
        {
          directoryName: 'workflows.alerts',
          inFolder: false,
          metaFile: false,
          parentXmlName: 'Workflow',
          xmlName: 'WorkflowAlert',
          xmlTag: 'alerts',
          key: 'fullName',
        },
      ],
      [
        'excluded',
        {
          directoryName: 'excluded',
          inFolder: false,
          metaFile: false,
          parentXmlName: 'Banished',
          xmlName: 'Excluded',
          xmlTag: 'excluded',
          key: 'other',
          excluded: true,
        },
      ],
    ])

    // Act
    let inFileAttributs = getInFileAttributs(metadata)

    // Assert
    expect(inFileAttributs.has('waveTemplates')).toBe(false)
    expect(inFileAttributs.has('excluded')).toBe(true)
    expect(inFileAttributs.has('alerts')).toBe(true)
    expect(inFileAttributs.get('alerts')).toEqual({
      xmlName: 'WorkflowAlert',
      key: 'fullName',
      excluded: false,
    })
    expect(inFileAttributs.get('excluded')).toEqual({
      xmlName: 'Excluded',
      key: 'other',
      excluded: true,
    })
  })
})
