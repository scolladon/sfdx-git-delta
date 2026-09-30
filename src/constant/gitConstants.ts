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
// The object id git gives a tree with no entries. It stands for "nothing"
// where a pass needs a revision holding no path at all.
export const EMPTY_TREE_OID = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
