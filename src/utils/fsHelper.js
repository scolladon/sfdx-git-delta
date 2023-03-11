'use strict'
const { readFile: fsReadFile } = require('fs').promises
const { XMLBuilder, XMLParser } = require('fast-xml-parser')
const { isAbsolute, join, relative } = require('path')
const { outputFile } = require('fs-extra')
const { spawn } = require('child_process')
const { XML_PARSER_OPTION, JSON_PARSER_OPTION } = require('./fxpHelper')
const { UTF8_ENCODING } = require('./gitConstants')
const { XML_HEADER_TAG_END } = require('./metadataConstants')
const {
  EOLRegex,
  getStreamContent,
  treatPathSep,
} = require('./childProcessUtils')

const FOLDER = 'tree'

const showCmd = ['--no-pager', 'show']
const gitPathSeparatorNormalizer = path => path?.replace(/\\+/g, '/')
const copiedFiles = new Set()

const copyFiles = async (config, src) => {
  if (copiedFiles.has(src)) return
  copiedFiles.add(src)

  const bufferData = await readPathFromGitAsBuffer(src, config)
  const utf8Data = bufferData?.toString(UTF8_ENCODING)
  if (!utf8Data) {
    return
  }

  if (utf8Data.startsWith(FOLDER)) {
    const [header, , ...files] = utf8Data.split(EOLRegex)
    const folder = header.split(':')[1]
    for (const file of files) {
      const fileSrc = join(folder, file)

      await copyFiles(config, fileSrc)
    }
  } else {
    const dst = join(config.output, treatPathSep(src))
    // Use Buffer to output the file content
    // Let fs implementation detect the encoding ("utf8" or "binary")
    await outputFile(dst, bufferData)
  }
}

const readPathFromGitAsBuffer = async (path, { repo, to }) => {
  const normalizedPath = gitPathSeparatorNormalizer(path)
  const bufferData = await getStreamContent(
    spawn('git', [...showCmd, `${to}:${normalizedPath}`], {
      cwd: repo,
    })
  )

  return bufferData
}

const readPathFromGit = async (path, config) => {
  const bufferData = await readPathFromGitAsBuffer(path, config)
  const utf8Data = bufferData.toString(UTF8_ENCODING)
  return utf8Data
}

const parseFile = async (line, config) => {
  const file = await readPathFromGit(line, config)
  const xmlParser = new XMLParser(XML_PARSER_OPTION)
  return xmlParser.parse(file)
}

const pathExists = async (path, config) => {
  const data = await readPathFromGit(path, config)
  return !!data
}

const readDir = async (dir, config) => {
  const data = await readPathFromGit(dir, config)
  const dirContent = []
  if (data.startsWith(FOLDER)) {
    const [, , ...files] = data.split(EOLRegex)
    dirContent.push(...files)
  }
  return dirContent
}

const readFile = async path => {
  const file = await fsReadFile(path, {
    encoding: UTF8_ENCODING,
  })
  return file
}

async function* scan(dir, config) {
  const entries = await readDir(dir, config)
  for (const file of entries) {
    const filePath = join(dir, file)
    if (file.endsWith('/')) {
      yield* scan(filePath, config)
    } else {
      yield filePath
    }
  }
}

const writeFile = async (path, jsonContent, config) => {
  const xmlBuilder = new XMLBuilder(JSON_PARSER_OPTION)
  const xmlContent = xmlBuilder.build(jsonContent)
  await outputFile(
    join(config.output, treatPathSep(path)),
    xmlContent.replace(XML_HEADER_TAG_END, `${XML_HEADER_TAG_END}`)
  )
}

async function* filterExt(it, ext) {
  for await (const file of it) {
    if (file.endsWith(ext)) {
      yield file
    }
  }
}

const isSubDir = (parent, dir) => {
  const rel = relative(parent, dir)
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel)
}

module.exports.copyFiles = copyFiles
module.exports.gitPathSeparatorNormalizer = gitPathSeparatorNormalizer
module.exports.isSubDir = isSubDir
module.exports.parseFile = parseFile
module.exports.pathExists = pathExists
module.exports.readDir = readDir
module.exports.readFile = readFile
module.exports.readPathFromGit = readPathFromGit
module.exports.scan = scan
module.exports.scanExtension = (dir, ext, config) =>
  filterExt(scan(dir, config), ext)
module.exports.writeFile = writeFile
