import { type Pathspec, parseSourceDirs } from '../../../lib/utils/pathspec.js'

export const sourceDirs = (...raw: string[]): Pathspec[] => {
  const { pathspecs, rejections } = parseSourceDirs(raw)
  if (rejections.length > 0) {
    throw new Error(
      `sourceDirs: rejected fixture value(s): ${rejections
        .map(rejection => `'${rejection.value}' (${rejection.reason})`)
        .join(', ')}`
    )
  }
  return pathspecs
}
