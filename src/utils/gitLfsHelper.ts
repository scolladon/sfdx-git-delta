'use strict'
import { sep } from 'node:path/posix'

import { UTF8_ENCODING } from '../constant/fsConstants.js'
import { GIT_FOLDER } from '../constant/gitConstants.js'

const LFS_HEADER = Buffer.from('version https://git-lfs')
// LFS object ids are sha256 hex — 64 lowercase [0-9a-f] characters. The
// regex guards against traversal via a crafted pointer (e.g. "oid
// sha256:../../etc/passwd") that would otherwise resolve under the repo
// root via join().
const LFS_OID_PATTERN = /^[a-f0-9]{64}$/

export const isLFS = (content: Buffer): boolean =>
  content.subarray(0, LFS_HEADER.length).equals(LFS_HEADER)

export const getLFSObjectContentPath = (bufferContent: Buffer): string => {
  const content = bufferContent.toString(UTF8_ENCODING)
  const oid = content.split(/\n/)[1]?.split(':')[1] ?? ''
  if (!LFS_OID_PATTERN.test(oid)) {
    throw new Error('Invalid LFS oid')
  }
  return [
    GIT_FOLDER,
    'lfs',
    'objects',
    oid.slice(0, 2),
    oid.slice(2, 4),
    oid,
  ].join(sep)
}
