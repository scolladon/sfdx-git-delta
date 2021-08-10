import StandardHandler from './standardHandler'
import { join, normalize, parse } from 'path'
import {existsSync,readdirSync} from 'fs'
import {META_REGEX, METAFILE_SUFFIX} from '../utils/metadataConstants'
import { ParsedPath } from 'path'

type FileTree = {
  [key: string]: Array<string>
}

const STATICRESOURCE_TYPE: string = 'staticresources'
const elementSrc: FileTree = {}

export default class ResourceHandler extends StandardHandler {
  override handleAddition(): void {
    super.handleAddition()
    if (!this.config.generateDelta) return

    const parseLineResult: RegExpMatchArray | null = this._parseLine()
    const parseTargetResult: RegExpMatchArray | null = `${join(this.config.output, this.line)}`.match(
      new RegExp(
        `.*[/\\\\]${StandardHandler.metadata[this.type].directoryName}`,
        'u'
      )
    )
    if(parseLineResult === null || parseTargetResult === null) return
    const [, srcPath, elementName] = parseLineResult
    const [targetPath] = parseTargetResult
    this._buildElementMap(srcPath)

    const matchingFiles = this._buildMatchingFiles(elementName)
    elementSrc[srcPath]
      .filter(
        (src: string): boolean =>
          (this.type === STATICRESOURCE_TYPE &&
            src.startsWith(parse(elementName).name)) ||
          matchingFiles.includes(src)
      )
      .forEach((src: string): void =>
        this.copyFiles(
          normalize(join(srcPath, src)),
          normalize(join(targetPath, src))
        )
      )
  }

  override handleDeletion(): void {
    const parseLineResult: RegExpMatchArray | null = this._parseLine()
    if(parseLineResult === null) return
    const [, srcPath, elementName] = parseLineResult
    if (
      existsSync(join(srcPath, elementName))) {
      this.handleModification()
    } else {
      super.handleDeletion()
    }
  }

  _parseLine(): RegExpMatchArray | null {
    return join(this.config.repo, this.line)
      .match(
        new RegExp(
          `(?<path>.*[/\\\\]${
            StandardHandler.metadata[this.type].directoryName
          })[/\\\\](?<name>[^/\\\\]*)+`,
          'u'
        )
      )
  }

  override getElementName(): string {
    const parsedPath = this.getParsedPath()
    return StandardHandler.cleanUpPackageMember(parsedPath.name)
  }

  override getParsedPath(): ParsedPath {
    return parse(
      this.splittedLine[this.splittedLine.indexOf(this.type) + 1]
        .replace(META_REGEX, '')
        .replace(this.suffixRegex, '')
    )
  }

  _buildMatchingFiles(elementName: string): string[] {
    const parsedElementName = parse(elementName).name
    const matchingFiles = [parsedElementName]
    if (StandardHandler.metadata[this.type].metaFile) {
      matchingFiles.push(
        `${parsedElementName}.${StandardHandler.metadata[this.type].suffix}${
          METAFILE_SUFFIX
        }`
      )
    }
    return matchingFiles
  }

  _buildElementMap(srcPath: string): void {
    if (!Object.prototype.hasOwnProperty.call(elementSrc, srcPath)) {
      elementSrc[srcPath] = 
      readdirSync(srcPath)
    }
  }
}
