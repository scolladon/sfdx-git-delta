'use strict'
import { join, sep } from 'path'
import { GIT_FOLDER } from './gitConstants'
import { EOL } from 'os'
import { copy } from 'fs-extra'
import { Config } from '../types/config'

const LFS_HEADER = 'version https://git-lfs'

export const isLFS = (content: string) => content.startsWith(LFS_HEADER)

export const copyLFS = async (
  { repo }: Config,
  dst: string,
  content: string
) => {
  const src = join(repo, GIT_FOLDER, getLFSObjectContentPath(content))
  await copy(src, dst)
}

const getLFSObjectContentPath = (content: string) => {
  const oid = content.split(EOL)[1].split(':')[1]
  return `lfs${sep}objects${sep}${oid.slice(0, 2)}${sep}${oid.slice(
    2,
    4
  )}${sep}${oid}`
}
