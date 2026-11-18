import type { ObjectId } from '@scolladon/tsgit'
import { PATH_SEP } from '../constant/fsConstants.js'
import { ROOT_PATHS } from './pathMatching.js'

// first index i with sorted[i] >= key; String `<` = the code-unit order
// Array#sort uses
export const lowerBound = (sorted: readonly string[], key: string): number => {
  let low = 0
  let high = sorted.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (sorted[middle] < key) {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return low
}

// Concrete repository paths are matched by directory prefix only — no
// wildmatch, no leading-prefix normalisation. A path off the repository can
// never carry a leading './' or '/' (treatPathSep and basePath already rule
// those out), and treating `[` as a glob-class opener would misread real
// path segments like an object folder named `Custom[1]__c`.
export class SortedPathIndex {
  private readonly sorted: readonly string[]

  constructor(private readonly blobIds: ReadonlyMap<string, ObjectId>) {
    this.sorted = [...blobIds.keys()].sort()
  }

  public pathsFor(specs: readonly string[]): string[] {
    const paths = new Set<string>()
    for (const spec of specs) {
      for (const path of this.pathsForSpec(spec)) {
        paths.add(path)
      }
    }
    return [...paths]
  }

  private pathsForSpec(spec: string): readonly string[] {
    if (ROOT_PATHS.has(spec)) return this.sorted
    // git cannot hold a blob and a tree at one path
    if (this.blobIds.has(spec)) return [spec]
    const prefix = spec + PATH_SEP
    const start = lowerBound(this.sorted, prefix)
    let end = start
    while (end < this.sorted.length && this.sorted[end].startsWith(prefix)) {
      end++
    }
    return this.sorted.slice(start, end)
  }
}
