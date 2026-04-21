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

  it('Given --changes-manifest flag, When running command, Then accepts the flag and completes successfully', () => {
    // Act
    const sut = run(
      'sgd source delta --from HEAD~1 --changes-manifest /tmp/sgd-nut-changes.json --json',
      0
    )

    // Assert
    expect(sut).toContain('output-dir')
  })
})
