'use strict'

import {
  type AddKind,
  ChangeKind,
  type ManifestElement,
  ManifestTarget,
} from '../types/handlerResult.js'
import type { Manifest } from '../types/work.js'

export type RenamePair = Readonly<{ from: string; to: string }>
// Keyed by type; each inner map dedupes pairs by `${from}\0${to}` so bundle
// renames re-emitted per file collapse to a single entry. NUL is chosen as
// the separator because Salesforce member names and git paths cannot contain
// it, eliminating any collision surface across from/to boundaries.
export type RenameBucket = Map<string, Map<string, RenamePair>>

const RENAME_KEY_SEPARATOR = '\0'
const renameKey = (from: string, to: string) =>
  `${from}${RENAME_KEY_SEPARATOR}${to}`

/**
 * Domain object that collects every component change observed in a diff and
 * derives the views consumed downstream:
 *   - Package manifest (`ManifestTarget.Package` entries + rename targets)
 *   - Destructive manifest (`ManifestTarget.DestructiveChanges` entries +
 *     rename sources — minus entries that also appear in the Package view)
 *   - Per-kind bucket map (used for the JSON review manifest)
 *
 * `ManifestTarget` and `ChangeKind` are orthogonal. A single ManifestElement
 * can be (target=Package, changeKind=Delete) — this happens when InFileHandler
 * treats a deleted container file as an addition to preserve surviving
 * sub-elements. The xml manifests MUST route on `target` (the deployment
 * contract); `changeKind` only drives the review-oriented JSON bucket.
 *
 * Insertion goes through `add` for single-component changes and
 * `recordRename` for rename pairs. Views are pure projections.
 */
export default class ChangeSet {
  private readonly byTarget: Record<ManifestTarget, Manifest> = {
    [ManifestTarget.Package]: new Map(),
    [ManifestTarget.DestructiveChanges]: new Map(),
  }
  private readonly byKind: Record<AddKind, Manifest> = {
    [ChangeKind.Add]: new Map(),
    [ChangeKind.Modify]: new Map(),
    [ChangeKind.Delete]: new Map(),
  }
  private readonly renames: RenameBucket = new Map()

  static from(elements: readonly ManifestElement[]): ChangeSet {
    const set = new ChangeSet()
    for (const element of elements) {
      set.addElement(element)
    }
    return set
  }

  // Precise insertion — respects the full (target, changeKind) discriminator.
  // Callers that know both axes use this; the handler pipeline feeds
  // ManifestElements through `from()`.
  addElement(element: ManifestElement): void {
    this._addToManifest(
      this.byTarget[element.target],
      element.type,
      element.member
    )
    this._addToManifest(
      this.byKind[element.changeKind],
      element.type,
      element.member
    )
  }

  // Diagnostic / test-only: reconstructs the (target, type, member, changeKind)
  // tuples by joining byTarget × byKind on (type, member). Production diff
  // lines never insert the same (type, member) under two different changeKind
  // values, so the join is unambiguous in practice. Production code should
  // use forPackageManifest / forDestructiveManifest / byChangeKind for the
  // indexed views — this method exists only so tests can list inserted
  // elements without paying a per-addElement push in the hot path.
  toElements(): ManifestElement[] {
    const targets = [
      ManifestTarget.Package,
      ManifestTarget.DestructiveChanges,
    ] as const
    const kinds = [
      ChangeKind.Add,
      ChangeKind.Modify,
      ChangeKind.Delete,
    ] as const
    const out: ManifestElement[] = []
    for (const target of targets) {
      for (const [type, members] of this.byTarget[target]) {
        for (const member of members) {
          let kind: AddKind | undefined
          for (const k of kinds) {
            if (this.byKind[k].get(type)?.has(member)) {
              kind = k
              break
            }
          }
          // Stryker disable next-line ConditionalExpression -- equivalent: see v8 ignore — the kind === undefined branch is unreachable because addElement keeps byTarget and byKind in lockstep
          /* v8 ignore next -- defensive: addElement always pairs byTarget and byKind, so every (type, member) in byTarget has a corresponding byKind entry */
          if (kind !== undefined) {
            out.push({ target, type, member, changeKind: kind })
          }
        }
      }
    }
    return out
  }

  // Convenience for callers (mostly tests) that operate under the standard
  // convention: Add/Modify target Package, Delete targets DestructiveChanges.
  // Production handlers that diverge from this convention (e.g. InFileHandler
  // treating a deleted container as an addition) MUST use addElement instead.
  add(kind: AddKind, type: string, member: string): void {
    const target =
      kind === ChangeKind.Delete
        ? ManifestTarget.DestructiveChanges
        : ManifestTarget.Package
    this.addElement({ target, type, member, changeKind: kind })
  }

  recordRename(type: string, from: string, to: string): void {
    if (from === to) return
    if (!this.renames.has(type)) {
      this.renames.set(type, new Map())
    }
    this.renames.get(type)!.set(renameKey(from, to), { from, to })
  }

  // Folds another ChangeSet's entries into this one. Used to combine
  // per-handler / per-collector outputs into a single project-wide view.
  // Mutates `this`; `other` is left untouched so the source can stay
  // referentially shared if a caller needs the snapshot it represents.
  merge(other: ChangeSet): void {
    for (const target of [
      ManifestTarget.Package,
      ManifestTarget.DestructiveChanges,
    ] as const) {
      for (const [type, members] of other.byTarget[target]) {
        for (const member of members) {
          this._addToManifest(this.byTarget[target], type, member)
        }
      }
    }
    for (const kind of [
      ChangeKind.Add,
      ChangeKind.Modify,
      ChangeKind.Delete,
    ] as const) {
      for (const [type, members] of other.byKind[kind]) {
        for (const member of members) {
          this._addToManifest(this.byKind[kind], type, member)
        }
      }
    }
    for (const [type, pairs] of other.renames) {
      for (const { from, to } of pairs.values()) {
        this.recordRename(type, from, to)
      }
    }
  }

  forPackageManifest(): Manifest {
    return this._unionByType([
      this.byTarget[ManifestTarget.Package],
      this._renameTargetsByType(),
    ])
  }

  forDestructiveManifest(): Manifest {
    const baseDeletes = this._unionByType([
      this.byTarget[ManifestTarget.DestructiveChanges],
      this._renameSourcesByType(),
    ])
    return this._subtractByType(baseDeletes, this.forPackageManifest())
  }

  byChangeKind(): Readonly<{
    [ChangeKind.Add]: Manifest
    [ChangeKind.Modify]: Manifest
    [ChangeKind.Delete]: Manifest
    [ChangeKind.Rename]: RenameBucket
  }> {
    // Rename participants move to the Rename bucket so every entry lives in
    // exactly one user-visible bucket.
    // Delete subtracts Add ∪ Modify (cancelled deletions) and rename sources.
    const targets = this._renameTargetsByType()
    const sources = this._renameSourcesByType()
    return {
      [ChangeKind.Add]: this._subtractByType(
        this.byKind[ChangeKind.Add],
        targets
      ),
      // Clone so callers that mutate the returned Modify view cannot corrupt
      // ChangeSet internal state. Add and Delete buckets are already new
      // Map instances returned by _subtractByType.
      [ChangeKind.Modify]: this._cloneManifest(this.byKind[ChangeKind.Modify]),
      [ChangeKind.Delete]: this._subtractByType(
        this.byKind[ChangeKind.Delete],
        this._unionByType([
          this.byKind[ChangeKind.Add],
          this.byKind[ChangeKind.Modify],
          sources,
        ])
      ),
      [ChangeKind.Rename]: this._cloneRenames(),
    }
  }

  private _addToManifest(
    manifest: Manifest,
    type: string,
    member: string
  ): void {
    if (!manifest.has(type)) {
      manifest.set(type, new Set())
    }
    manifest.get(type)!.add(member)
  }

  private _cloneManifest(manifest: Manifest): Manifest {
    const clone: Manifest = new Map()
    for (const [type, members] of manifest) {
      clone.set(type, new Set(members))
    }
    return clone
  }

  // `recordRename` always inserts at least one pair per type key, so the
  // inner Set is non-empty by construction. No size check needed.
  private _renameTargetsByType(): Manifest {
    const result: Manifest = new Map()
    for (const [type, pairs] of this.renames) {
      const members = new Set<string>()
      for (const { to } of pairs.values()) members.add(to)
      result.set(type, members)
    }
    return result
  }

  private _renameSourcesByType(): Manifest {
    const result: Manifest = new Map()
    for (const [type, pairs] of this.renames) {
      const members = new Set<string>()
      for (const { from } of pairs.values()) members.add(from)
      result.set(type, members)
    }
    return result
  }

  private _cloneRenames(): RenameBucket {
    const clone: RenameBucket = new Map()
    for (const [type, pairs] of this.renames) {
      clone.set(type, new Map(pairs))
    }
    return clone
  }

  private _unionByType(manifests: readonly Manifest[]): Manifest {
    const result: Manifest = new Map()
    for (const manifest of manifests) {
      for (const [type, members] of manifest) {
        const existing = result.get(type)
        if (existing) {
          for (const member of members) existing.add(member)
        } else {
          result.set(type, new Set(members))
        }
      }
    }
    return result
  }

  private _subtractByType(base: Manifest, minus: Manifest): Manifest {
    const result: Manifest = new Map()
    for (const [type, members] of base) {
      const cancellers = minus.get(type)
      const remaining = new Set<string>()
      for (const member of members) {
        if (!cancellers?.has(member)) {
          remaining.add(member)
        }
      }
      if (remaining.size > 0) {
        result.set(type, remaining)
      }
    }
    return result
  }
}

// HandlerResult helpers live next to ChangeSet because they construct it
// at runtime; keeping them here avoids a circular module dep with
// handlerResult.ts (which only imports the type).
import type { CopyOperation, HandlerResult } from '../types/handlerResult.js'

export const emptyResult = (): HandlerResult => ({
  changes: new ChangeSet(),
  copies: [] as CopyOperation[],
  warnings: [] as Error[],
})

export const mergeResults = (...results: HandlerResult[]): HandlerResult => {
  const merged = new ChangeSet()
  for (const r of results) merged.merge(r.changes)
  return {
    changes: merged,
    copies: results.flatMap(r => r.copies),
    warnings: results.flatMap(r => r.warnings),
  }
}
