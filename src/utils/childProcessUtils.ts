'use strict'
import { normalize, sep } from 'path'

export const EOLRegex = /\r?\n/g

export const treatPathSep = (data: string) => data.replace(/[/\\]+/g, sep)

export const sanitizePath = (data: string) =>
  data !== null && data !== undefined ? normalize(treatPathSep(data)) : data

// REFACTOR using native readLine https://nodejs.org/api/readline.html when using node 19.5
/*
const linify = stream => {
  return createInterface({
    input: stream,
    crlfDelay: Infinity,
    historySize: 0,
})
*/
export async function* linify(stream) {
  let previous = ''
  for await (const chunk of stream) {
    previous += chunk
    let eolIndex = previous.search(EOLRegex)
    while (eolIndex >= 0) {
      yield previous.slice(0, eolIndex)
      previous = previous.slice(eolIndex + 1)
      eolIndex = previous.search(EOLRegex)
    }
  }
  if (previous.length > 0) {
    yield previous
  }
}

export const getStreamContent = async stream => {
  return new Promise<Buffer>((resolve, reject) => {
    const content: Buffer[] = []
    const error: string[] = []

    stream.stdout.on('data', data => {
      content.push(data)
    })

    stream.stderr.setEncoding('utf8')
    stream.stderr.on('data', data => {
      error.push(data.toString())
    })

    stream.on('close', code => {
      if (code !== 0) {
        reject(new Error(error.join('')))
      }

      resolve(Buffer.concat(content))
    })
  })
}
