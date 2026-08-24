'use strict'
import { rm } from 'node:fs/promises'

import { openRepository } from '@scolladon/tsgit'
import { afterAll, describe, expect, it } from 'vitest'

import { createTempDir } from '../../__utils__/gitTestHarness'

// GitAdapter's open-repository option object — trust: 'always', hooks:
// false, command: false — is otherwise pinned only against a MOCKED
// openRepository (GitAdapter.test.ts). The real engine silently accepts
// unknown option names: openRepository({ cwd, trust: 'always',
// bogusOption: 1 }) resolves without error. So an upstream rename of any
// of those three keys would pass the mocked suite unchanged and go
// completely undetected here, until it started leaking a raw tsgit
// refusal to users. `trust` is the one key of the three the real engine
// still value-validates, so a rejection naming it is the only lever
// available to prove the key is live and still spelled this way.
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

afterAll(async () => {
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})

describe('Given the real tsgit engine validating open-repository options', () => {
  describe('When trust is set to a value the engine does not recognize', () => {
    it('Then it rejects naming the trust option, proving the key is still live and value-validated', async () => {
      // Arrange
      const cwd = await trackedTempDir('sgd-option-contract-trust-')
      const sut = openRepository

      // Act
      const error = await sut({ cwd, trust: 'never' }).catch(
        (thrown: unknown) => thrown
      )

      // Assert
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe(
        "INVALID_OPTION: invalid option: trust — must be 'ownership' or 'always'"
      )
    })
  })

  // hooks and command carry no equivalent lever. Verified against the real
  // engine: openRepository({ cwd, trust: 'always', hooks: 'not-a-boolean' })
  // and the same probe against `command` both resolve without error —
  // wrong-typed values are silently accepted, indistinguishable from an
  // unknown option name going through unchecked. There is no engine-side
  // rejection to assert against, so a rename of either key would go
  // undetected here exactly as it already would for a genuinely unknown
  // option. This is an honest, documented gap rather than an assertion
  // dressed up to look like a guard: the branch's ratified decision was
  // not to synthesize a DUBIOUS_OWNERSHIP refusal arm for the same reason
  // — a real gap, left visible, beats a fake one, hidden.
})
