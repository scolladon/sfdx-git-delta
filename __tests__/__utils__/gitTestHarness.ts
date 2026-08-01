'use strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'

// CI runners are ephemeral and carry no `user.name`/`user.email`: any
// plumbing command that creates a commit or annotated tag object
// (commit-tree, tag -a) fails with "unable to auto-detect email address"
// unless identity is supplied explicitly. Applying it to every git
// invocation through this single choke point — rather than per call site —
// keeps the rule uniform and trivially auditable.
const IDENTITY_ARGS = [
  '-c',
  'user.name=sgd-test',
  '-c',
  'user.email=sgd-test@example.com',
]

const IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'sgd-test',
  GIT_AUTHOR_EMAIL: 'sgd-test@example.com',
  GIT_COMMITTER_NAME: 'sgd-test',
  GIT_COMMITTER_EMAIL: 'sgd-test@example.com',
}

const MAX_BUFFER = 64 * 1024 * 1024

export type GitInvocation = {
  cwd?: string
  input?: Buffer
}

export const runGit = (
  args: string[],
  invocation: GitInvocation = {}
): Buffer =>
  execFileSync('git', [...IDENTITY_ARGS, ...args], {
    cwd: invocation.cwd,
    input: invocation.input,
    env: { ...process.env, ...IDENTITY_ENV },
    maxBuffer: MAX_BUFFER,
  })

export const runGitText = (
  args: string[],
  invocation: GitInvocation = {}
): string => runGit(args, invocation).toString('utf8').trim()

export const runGitLines = (
  args: string[],
  invocation: GitInvocation = {}
): string[] =>
  runGitText(args, invocation)
    .split('\n')
    .filter(line => line.length > 0)
    .sort()

export const createTempDir = (prefix: string): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix))

// `git clone --depth` is a documented no-op against a bare filesystem path
// (git prints "--depth is ignored in local clones"), so the shallow-clone
// scenario needs a real file:// URL. win32 paths use `\` and a drive
// letter, so a plain `file://${path}` is not a valid URL there — it needs
// forward slashes and a triple slash before the drive letter.
export const toFileUrl = (absolutePath: string): string => {
  const normalized = absolutePath.split(sep).join('/')
  const withLeadingSlash = normalized.startsWith('/')
    ? normalized
    : `/${normalized}`
  return `file://${withLeadingSlash}`
}
