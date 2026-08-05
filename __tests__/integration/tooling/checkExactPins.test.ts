'use strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const sut = resolve(__dirname, '../../../tooling/checkExactPins.mjs')

let workdir: string

const runAgainst = (manifest: object) => {
  writeFileSync(join(workdir, 'package.json'), JSON.stringify(manifest))
  return spawnSync(process.execPath, [sut], {
    cwd: workdir,
    encoding: 'utf-8',
  })
}

describe('Given the exact-pin gate', () => {
  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), 'sgd-pins-'))
  })

  afterEach(() => {
    rmSync(workdir, { recursive: true, force: true })
  })

  it('When every runtime dependency is an exact version, Then it passes and reports the count', () => {
    // Arrange
    const manifest = { dependencies: { txml: '6.0.0', zod: '4.4.3' } }

    // Act
    const result = runAgainst(manifest)

    // Assert
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('2 runtime dependencies are exact pins')
  })

  it('When a runtime dependency carries a range, Then it fails and names the offender', () => {
    // Arrange
    const manifest = { dependencies: { txml: '6.0.0', zod: '^4.4.3' } }

    // Act
    const result = runAgainst(manifest)

    // Assert
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('zod: ^4.4.3')
    expect(result.stderr).not.toContain('txml')
  })

  it('When a runtime dependency uses a protocol specifier, Then it fails', () => {
    // Arrange
    const manifest = { dependencies: { zod: 'npm:zod@4.4.3' } }

    // Act
    const result = runAgainst(manifest)

    // Assert
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('zod: npm:zod@4.4.3')
  })

  it('When an exact version carries a prerelease and build metadata, Then it passes', () => {
    // Arrange
    const manifest = { dependencies: { zod: '4.4.3-rc.1+build.5' } }

    // Act
    const result = runAgainst(manifest)

    // Assert
    expect(result.status).toBe(0)
  })

  it('When the manifest declares no runtime dependencies, Then it refuses to pass vacuously', () => {
    // Arrange
    const manifest = { dependencies: {} }

    // Act
    const result = runAgainst(manifest)

    // Assert
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('refusing to pass vacuously')
  })
})
