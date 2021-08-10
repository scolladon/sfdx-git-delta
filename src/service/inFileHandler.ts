import {getFileDiff}from '../utils/fileGitDiff'
import { MINUS, PLUS } from '../utils/gitConstants'
import {LABEL_DIRECTORY_NAME, LABEL_EXTENSION}from '../utils/metadataConstants'
import StandardHandler from './standardHandler'
import {outputFileSync}from 'fs-extra'
import {EOL} from 'os'
import { basename, join } from 'path'
import {j2xParser, parse, X2jOptionsOptional, J2xOptionsOptional}from 'fast-xml-parser'
import { Result } from '../model/Result'
import { MetadataElement, MetadataRepository } from '../model/Metadata'
import { Package } from '../model/Package'

const FULLNAME: string = 'fullName'
const FULLNAME_XML_TAG: RegExp = new RegExp(`<${FULLNAME}>(.*)</${FULLNAME}>`)
const XML_TAG: RegExp = new RegExp(`^[${MINUS}${PLUS}]?\\s*<([^(/><.)]+)>\\s*$`)
const XML_HEADER: string = '<?xml version="1.0" encoding="utf-8"?>\n'
const XML_PARSER_OPTION:X2jOptionsOptional = {
  ignoreAttributes: false,
  ignoreNameSpace: false,
  parseNodeValue: false,
  parseAttributeValue: false,
  trimValues: true,
}
const JSON_PARSER_OPTION:J2xOptionsOptional = {
  ignoreAttributes: false,
  format: true,
  indentBy: '    ',
}

type ParsedXml = {
  authorizedKeys: Array<string>
  fileContent: JSONMetadataFile
}

type DiffAlgoData = {
  toDel: Package,
  toAdd: Package,
  potentialType: string,
  subType: string,
  fullName: string,
}

type JSONMetadataFile = {
  [key: string]: {}
}

export default class InFileHandler extends StandardHandler {
  private static xmlObjectToPackageType:MetadataRepository

  private readonly parentMetadata: MetadataElement
  private readonly customLabelElementName: string

  constructor(
    line: string,
    type: string,
    work: Result,
    metadata: MetadataRepository
  ) {
    super(line, type, work, metadata)
    this.parentMetadata = StandardHandler.metadata[this.type]
    this.customLabelElementName = `${basename(this.line).split('.')[0]}.`
    InFileHandler.xmlObjectToPackageType =
      InFileHandler.xmlObjectToPackageType ?? this.buildObjectToPackage()
  }

  public override handleAddition(): void {
    super.handleAddition()
    const toAdd = this.handleInDiff()
    this.handleFileWriting(toAdd)
  }

  protected override handleDeletion(): void {
    this.handleInDiff()
  }

  protected override handleModification(): void {
    super.handleAddition()
    const toAdd = this.handleInDiff()
    this.handleFileWriting(toAdd)
  }

  private buildObjectToPackage(): MetadataRepository {
    return Object.keys(StandardHandler.metadata)
    .filter(meta => !!StandardHandler.metadata[meta].xmlTag)
    .reduce((acc, meta) => {
      acc[StandardHandler.metadata[meta].xmlTag as keyof MetadataRepository] =
        StandardHandler.metadata[meta]

      return acc
    }, {} as MetadataRepository)
  }

  private handleFileWriting(toAdd: Package): void {
    if (!this.config.generateDelta) return
    const result = this.parseFile()
    const metadataContent: any = Object.values(result.fileContent)[0]

    result.authorizedKeys.forEach((subType:string) => {
      const meta = Array.isArray(metadataContent[subType])
        ? metadataContent[subType]
        : [metadataContent[subType]]
      metadataContent[subType] = meta.filter((elem: any) =>
        toAdd[
          InFileHandler.xmlObjectToPackageType[subType].directoryName
        ]?.has(elem.fullName)
      )
    })
    const xmlBuilder = new j2xParser(JSON_PARSER_OPTION)
    const xmlContent = XML_HEADER + xmlBuilder.parse(result.fileContent)
    outputFileSync(join(this.config.output, this.line), xmlContent)
  }

  private handleInDiff(): Package {
    const diffContent = getFileDiff(this.line, this.config)
    const data: DiffAlgoData = {
      toDel: {},
      toAdd: {},
      potentialType: '',
      subType: '',
      fullName: '',
    }
    diffContent.split(EOL).forEach(line => {
      this.preProcessHandleInDiff(line, data)
      if (!data.subType || !data.fullName) return
      this.postProcessHandleInDiff(line, data)
    })
    this.treatInFileResult(data.toDel, data.toAdd)
    return data.toAdd
  }

  private preProcessHandleInDiff(line: string, data:DiffAlgoData): void {
    if (FULLNAME_XML_TAG.test(line)) {
      const parsedFullName = line.match(FULLNAME_XML_TAG)
      if(parsedFullName !== null) {
        data.fullName = parsedFullName[1]
        data.subType = `${this.parentMetadata.directoryName}.${data.potentialType}`
      }
    }
    const xmlTagMatchResult = line.match(XML_TAG)
    if (xmlTagMatchResult !== null && InFileHandler._matchAllowedXmlTag(xmlTagMatchResult)) {
      data.potentialType = xmlTagMatchResult[1]
      data.fullName = ''
    }
  }

  private postProcessHandleInDiff(line: string, data:DiffAlgoData): void {
    let tempMap
    if (line.startsWith(MINUS) && line.includes(FULLNAME)) {
      tempMap = data.toDel
    } else if (line.startsWith(PLUS) || line.startsWith(MINUS)) {
      tempMap = data.toAdd
    }
    if (tempMap) {
      tempMap[data.subType] =
        tempMap[data.subType]?.add(data.fullName) ?? new Set([data.fullName])
      data.subType = data.fullName = ''
    }
  }

  private treatInFileResult(toRemove: Package, toAdd: Package): void {
    Object.keys(toRemove).forEach(type =>
      [...toRemove[type]]
        .filter(elem => !toAdd[type] || !toAdd[type].has(elem))
        .forEach(fullName =>
          this.fillPackageFromDiff(
            this.diffs.destructiveChanges,
            type,
            fullName
          )
        )
    )
    Object.keys(toAdd).forEach(type =>
      toAdd[type].forEach((fullName: string) =>
        this.fillPackageFromDiff(this.diffs.package, type, fullName)
      )
    )
  }

  private parseFile(): ParsedXml {
    const result: JSONMetadataFile = parse(this.readFileSync(), XML_PARSER_OPTION, true)
    const authorizedKeys = Object.keys(Object.values(result)?.[0]).filter(tag =>
      Object.prototype.hasOwnProperty.call(
        InFileHandler.xmlObjectToPackageType,
        tag
      )
    )
    return {
      authorizedKeys: authorizedKeys,
      fileContent: result,
    }
  }

  protected override fillPackage(packageObject: Package): void {
    if (this.type !== LABEL_EXTENSION) {
      super.fillPackage(packageObject)
    }
  }

  private fillPackageFromDiff(packageObject: Package, subType: string, value: string): void {
    const elementFullName = `${
      (subType !== LABEL_DIRECTORY_NAME ? this.customLabelElementName : '') +
      value
    }`

    packageObject[subType] = packageObject[subType] ?? new Set()
    packageObject[subType].add(
      StandardHandler.cleanUpPackageMember(elementFullName)
    )
  }

  private static _matchAllowedXmlTag(matchResult: RegExpMatchArray): boolean {
    return (
      Object.prototype.hasOwnProperty.call(
        InFileHandler.xmlObjectToPackageType,
        matchResult?.[1]
      )
    )
  }
}
