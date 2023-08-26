'use strict'
import { SpawnOptionsWithoutStdio, spawn } from 'child_process'
import { normalize, sep } from 'path'

export const EOLRegex: RegExp = /\r?\n/g

export const treatPathSep = (data: string) => data.replace(/[/\\]+/g, sep)

export const sanitizePath = (data: string) => normalize(treatPathSep(data))

export const getSpawnContentByLine = async (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio = {}
): Promise<string[]> => {
  const stream = spawn(command, [...args], options)
  return new Promise<string[]>((resolve, reject) => {
    const content: string[] = []
    const error: string[] = []

    let previous = ''

    stream.stdout.on('data', (data: Buffer) => {
      previous += data
      let eolIndex = previous.search(EOLRegex)
      while (eolIndex >= 0) {
        content.push(previous.slice(0, eolIndex))
        previous = previous.slice(eolIndex + 1)
        eolIndex = previous.search(EOLRegex)
      }
    })

    stream.stderr.setEncoding('utf8')
    stream.stderr.on('data', (data: string) => {
      error.push(data.toString())
    })

    stream.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(error.join('')))
      }

      if (previous.length > 0) {
        content.push(previous)
      }

      resolve(content)
    })
  })
}

export const getSpawnContent = async (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio = {}
): Promise<Buffer> => {
  const stream = spawn(command, [...args], options)
  return new Promise<Buffer>((resolve, reject) => {
    const content: Buffer[] = []
    const error: string[] = []

    stream.stdout.on('data', (data: Buffer) => {
      content.push(data)
    })

    stream.stderr.setEncoding('utf8')
    stream.stderr.on('data', (data: string) => {
      error.push(data.toString())
    })

    stream.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(error.join('')))
      }

      resolve(Buffer.concat(content))
    })
  })
}
