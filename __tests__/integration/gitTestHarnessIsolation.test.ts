'use strict'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createTempDir, runGit, runGitText } from '../__utils__/gitTestHarness'

// Git hooks export GIT_DIR (and friends) into the environment of everything
// they run, and a child `git` honours those over `cwd`. Without scrubbing,
// every fixture command in the suite retargets whatever repository the
// ambient GIT_DIR names — in practice the developer's own checkout, whose
// core.bare gets flipped and whose branch gets moved onto fixture commits.
describe('Given an ambient GIT_DIR, as a git hook exports', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    vi.unstubAllEnvs()
    await Promise.all(
      tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
    )
    tempDirs.length = 0
  })

  const makeRepoWithACommit = async (prefix: string): Promise<string> => {
    const dir = await createTempDir(prefix)
    tempDirs.push(dir)
    runGit(['init', '--quiet'], { cwd: dir })
    runGit(['commit', '--quiet', '--allow-empty', '-m', 'root'], { cwd: dir })
    return dir
  }

  it('When a fixture command runs, Then it targets its own cwd and leaves the ambient repository untouched', async () => {
    // Arrange — `bystander` stands in for the developer's real checkout, the
    // one the ambient GIT_DIR points at while a hook is running.
    const bystander = await makeRepoWithACommit('sgd-bystander-')
    const headBefore = runGitText(['rev-parse', 'HEAD'], { cwd: bystander })
    const target = await createTempDir('sgd-target-')
    tempDirs.push(target)
    vi.stubEnv('GIT_DIR', join(bystander, '.git'))

    // Act
    runGit(['init', '--quiet'], { cwd: target })
    const sut = runGit(
      ['commit', '--quiet', '--allow-empty', '-m', 'fixture'],
      {
        cwd: target,
      }
    )

    // Assert
    expect(sut).toBeDefined()
    expect(existsSync(join(target, '.git'))).toBe(true)
    expect(runGitText(['rev-parse', 'HEAD'], { cwd: bystander })).toBe(
      headBefore
    )
    expect(
      runGitText(['config', '--get', 'core.bare'], { cwd: bystander })
    ).toBe('false')
  })
})
