import { flags, SfdxCommand } from '@salesforce/command'
import { Messages, SfdxProject } from '@salesforce/core'
import { AnyJson, JsonArray } from '@salesforce/ts-types'
import { findInDir } from '../../../utils/findInDir'
import * as gc from '../../../utils/gitConstants'
import * as pc from '../../../utils/parsingConstants'

import * as fs from 'fs'
import * as fxp from 'fast-xml-parser'
import * as path from 'path'

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname)
const COMMAND_NAME = 'ppset'

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfdx-git-delta', COMMAND_NAME)
const INPUT_DELIMITER = ':'

const profilePackageMapping = {
  applicationVisibilities: { xmlTag: 'CustomApplication', key: 'application' },
  categoryGroupVisibilities: {
    xmlTag: 'DataCategoryGroup',
    key: 'dataCategoryGroup',
  },
  classAccesses: { xmlTag: 'ApexClass', key: 'apexClass' },
  customMetadataTypeAccesses: { xmlTag: 'CustomMetadata', key: 'name' },
  customPermissions: { xmlTag: 'CustomPermission', key: 'name' },
  customSettingAccesses: { xmlTag: 'CustomObject', key: 'name' },
  externalDataSourceAccesses: {
    xmlTag: 'ExternalDataSource',
    key: 'externalDataSource',
  },
  fieldPermissions: { xmlTag: 'CustomField', key: 'field' },
  layoutAssignments: { xmlTag: 'Layout', key: 'layout' }, // recordtype
  objectPermissions: { xmlTag: 'CustomObject', key: 'object' },
  pageAccesses: { xmlTag: 'ApexPage', key: 'apexPage' },
  recordTypeVisibilities: { xmlTag: 'RecordType', key: 'recordType' },
  tabVisibilities: { xmlTag: 'CustomTab', key: 'tab' },
  tabSettings: { xmlTag: 'CustomTab', key: 'tab' },
}

const FILE_READ_OPTIONS = {
  encoding: gc.UTF8_ENCODING,
}

export default class Ppset extends SfdxCommand {
  public static description = messages.getMessage('command', [])

  protected static flagsConfig = {
    packages: flags.array({
      char: 'p',
      description: messages.getMessage('packagesFlagDescription', [
        INPUT_DELIMITER,
      ]),
      delimiter: INPUT_DELIMITER,
      map: (val: string) => path.parse(val),
      required: true,
    }),
    sources: flags.array({
      char: 's',
      description: messages.getMessage('sourcesFlagDescription', [
        INPUT_DELIMITER,
      ]),
      delimiter: INPUT_DELIMITER,
      map: (val: string) => path.parse(val),
    }),
    'permissions-type': flags.array({
      char: 't',
      description: messages.getMessage('permissionsTypeFlagDescription', [
        Object.keys(profilePackageMapping).join('|'),
        INPUT_DELIMITER,
      ]),
      delimiter: INPUT_DELIMITER,
    }),
    'user-permissions': flags.array({
      char: 'r',
      description: messages.getMessage('userPermissionsFlagDescription', [
        INPUT_DELIMITER,
      ]),
      delimiter: INPUT_DELIMITER,
    }),
  }

  protected static requiresProject = true

  public async run(): Promise<AnyJson> {
    const project = await SfdxProject.resolve()
    const projectJson = await project.resolveProjectConfig()
    const basePath = project.getPath()
    const packageDirectories = projectJson['packageDirectories'] as JsonArray
    const defaultDir = packageDirectories.reduce(
      (a, v) => (v['default'] === true ? (a = v['path']) : (a = a)),
      ''
    )

    const sources = this.flags.sources || []
    const userPermissions = this.flags['user-permissions'] || []
    const dirList = packageDirectories.filter(dir => sources.includes(dir))
    if (dirList.length === 0) {
      dirList.push(defaultDir)
    }

    const packages = this.flags.packages.map(packageFile =>
      fxp.parse(
        fs.readFileSync(path.format(packageFile), FILE_READ_OPTIONS),
        pc.XML_PARSER_OPTION
      )
    )
    const allowedPermissions = this.flags['permissions-type'] || []

    const xmlBuilder = new fxp.j2xParser(pc.JSON_PARSER_OPTION)
    dirList.forEach(dir =>
      findInDir(
        path.join(basePath, `${dir}`),
        /(?!permissionsetgroup)(\.profile)|(\.permissionset)/
      )
        .filter(file => {
          const fileName = path.parse(file).name.split('.')[0]
          return (
            packages.some(jsonObject =>
              jsonObject?.Package[0]?.types
                .filter(x => x.name === 'Profile')[0]
                .members.includes(fileName)
            ) ||
            packages.some(jsonObject =>
              jsonObject?.Package[0]?.types
                .filter(x => x.name === 'PermissionSet')[0]
                .members.includes(fileName)
            )
          )
        })
        .forEach(file => {
          // Filter content based on the package.xml and the ppset
          const content = fxp.parse(
            fs.readFileSync(file, FILE_READ_OPTIONS),
            pc.XML_PARSER_OPTION
          )
          const permissionContent = Object.values(content)[0][0]
          let authorizedKeys = Object.keys(permissionContent).filter(x =>
            Object.keys(profilePackageMapping).includes(x)
          )
          if (allowedPermissions.length > 0) {
            authorizedKeys = authorizedKeys.filter(x =>
              allowedPermissions.includes(x)
            )
          }

          authorizedKeys.forEach(permission => {
            const values = new Set()
            packages.forEach(jsonObject =>
              jsonObject?.Package[0]?.types
                .filter(
                  e => e.name === profilePackageMapping[permission].xmlTag
                )
                .forEach(element =>
                  Array.isArray(element.members)
                    ? element.members.forEach(member => values.add(member))
                    : values.add(element.members)
                )
            )
            permissionContent[permission] = permissionContent[
              permission
            ].filter(element =>
              values.has(element[profilePackageMapping[permission].key])
            )
          })

          const inFileUserPermissions =
            permissionContent['userPermissions'] ?? []
          permissionContent['userPermissions'] =
            userPermissions.length > 0
              ? inFileUserPermissions.filter(up =>
                  userPermissions.includes(up.name)
                )
              : []
          const xmlContent = pc.XML_HEADER + xmlBuilder.parse(content)
          fs.writeFileSync(file, xmlContent)
        })
    )
    return null
  }
}
