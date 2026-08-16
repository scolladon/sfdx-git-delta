'use strict'
import { execCmd } from '@salesforce/cli-plugins-testkit'
import { describe, expect, it } from 'vitest'

const run = (cmd: string, exitCode: number): string =>
  String(execCmd(cmd, { ensureExitCode: exitCode }).shellOutput)

describe('sgd source delta NUTS', () => {
  it('Given --help flag, When running command, Then displays help', () => {
    // Act
    const sut = run('sgd source delta --help', 0)

    // Assert
    expect(sut).toContain('incremental')
  })

  it('Given missing required --from flag, When running command, Then exits with error', () => {
    // Act
    const sut = run('sgd source delta --json', 2)

    // Assert
    expect(sut).toContain('from')
  })

  it('Given invalid --from sha, When running command, Then exits with error', () => {
    // Act
    const sut = run(
      'sgd source delta --from "invalid_sha_that_does_not_exist" --json',
      1
    )

    // Assert
    expect(sut).toContain('error')
  })

  it('Given non-existing --repo-dir, When running command, Then exits with error', () => {
    // Act
    const sut = run(
      'sgd source delta --from HEAD~1 --repo-dir /non/existing/path --json',
      1
    )

    // Assert
    expect(sut).toContain('No directory found')
  })

  it('Given non-existing --output-dir, When running command, Then exits with error', () => {
    // Act
    const sut = run(
      'sgd source delta --from HEAD~1 --output-dir /non/existing/path --json',
      1
    )

    // Assert
    expect(sut).toContain('No directory found')
  })

  it('Given non-existing --ignore-file, When running command, Then exits with error', () => {
    // Act
    const sut = run(
      'sgd source delta --from HEAD~1 --ignore-file /non/existing/file --json',
      1
    )

    // Assert
    expect(sut).toContain('No file found')
  })

  it('Given non-existing --ignore-destructive-file, When running command, Then exits with error', () => {
    // Act
    const sut = run(
      'sgd source delta --from HEAD~1 --ignore-destructive-file /non/existing/file --json',
      1
    )

    // Assert
    expect(sut).toContain('No file found')
  })

  it('Given non-existing --include-file, When running command, Then exits with error', () => {
    // Act
    const sut = run(
      'sgd source delta --from HEAD~1 --include-file /non/existing/file --json',
      1
    )

    // Assert
    expect(sut).toContain('No file found')
  })

  it('Given non-existing --include-destructive-file, When running command, Then exits with error', () => {
    // Act
    const sut = run(
      'sgd source delta --from HEAD~1 --include-destructive-file /non/existing/file --json',
      1
    )

    // Assert
    expect(sut).toContain('No file found')
  })

  it('Given non-existing --additional-metadata-registry, When running command, Then exits with error', () => {
    // Act
    const sut = run(
      'sgd source delta --from HEAD~1 --additional-metadata-registry /non/existing/file --json',
      1
    )

    // Assert
    expect(sut).toContain('No file found')
  })

  it('Given --merge-base flag, When running command, Then oclif accepts the flag', () => {
    // Act — merge-base(HEAD~2, HEAD) === HEAD~2 on any first-parent-reachable
    // ancestor, so this is a flag-acceptance smoke test only: it does not
    // prove the resolved base is used, since a no-op rewrite of `from`
    // would pass it identically. See the "merge-base resolution" integration
    // test for the assertion that actually exercises divergent resolution.
    const sut = run('sgd source delta --from HEAD~2 --merge-base --json', 0)

    // Assert
    expect(sut).toContain('output-dir')
  })

  it('Given the -b short form of --merge-base, When running command, Then oclif accepts the flag', () => {
    // Act — same flag-acceptance caveat as above: HEAD~2 is already an
    // ancestor of HEAD, so this cannot distinguish the resolved base from
    // the raw --from value.
    const sut = run('sgd source delta --from HEAD~2 -b --json', 0)

    // Assert
    expect(sut).toContain('output-dir')
  })

  it('Given --changes-manifest flag, When running command, Then oclif accepts the flag', () => {
    // Act — uses the same invalid-sha pattern as the --from test above so
    // exit code is deterministic across environments (shallow clones on CI
    // vs full clones locally would both fail ref resolution with exit 1
    // regardless). An unknown flag would exit 2 from oclif instead.
    const sut = run(
      'sgd source delta --from "invalid_sha_that_does_not_exist" --changes-manifest /tmp/sgd-nut-changes.json --json',
      1
    )

    // Assert
    expect(sut).toContain('output-dir')
  })
})
