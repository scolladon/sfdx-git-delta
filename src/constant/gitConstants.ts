'use strict'
export const ADDITION = 'A'
export const DELETION = 'D'
// git -M rename status lines start with "R" followed by a 3-digit similarity
// score (e.g. "R095"). We match on the leading letter rather than the full
// prefix because the score is not fixed-width across git versions.
export const RENAMED = 'R'
export const GIT_DIFF_TYPE_REGEX = /^.\s+/u
export const GIT_FOLDER = '.git'
export const HEAD = 'HEAD'
export const MODIFICATION = 'M'
