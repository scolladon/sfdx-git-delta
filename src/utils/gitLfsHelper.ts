'use strict'
import { sep } from 'path'

import { UTF8_ENCODING } from '../constant/fsConstants'
import { GIT_FOLDER } from '../constant/gitConstants'

const LFS_HEADER = Buffer.from('version https://git-lfs')

export const isLFS = (content: Buffer): boolean =>
  content.subarray(0, LFS_HEADER.length).equals(LFS_HEADER)

export const getLFSObjectContentPath = (bufferContent: Buffer): string => {
  const content = bufferContent.toString(UTF8_ENCODING)
  const oid = content.split(/\n/)[1].split(':')[1]
  return [
    GIT_FOLDER,
    'lfs',
    'objects',
    oid.slice(0, 2),
    oid.slice(2, 4),
    oid,
  ].join(sep)
}
