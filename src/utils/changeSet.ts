'use strict'

import { DOT, PATH_SEP } from '../constant/fsConstants.js'
import {
  BOT_TYPE,
  BOT_VERSION_TYPE,
  FOLDER_MOVE_ON_DEPLOY_TYPES,
} from '../constant/metadataConstants.js'
import {
  type AddKind,
  ChangeKind,
  type ManifestElement,
  ManifestTarget,
} from '../types/handlerResult.js'
import type { Manifest } from '../types/work.js'

export type RenamePair = Readonly<{ from: string; to: string }>
export type RenameTriple = Readonly<{ type: string; from: string; to: string }>
// Keyed by type; each inner map dedupes pairs by `${from}\0${to}` so bundle
// renames re-emitted per file collapse to a single entry. NUL is chosen as
// the separator because Salesforce member names and git paths cannot contain
// it, eliminating any collision surface across from/to boundaries.
export type RenameBucket = Map<string, Map<string, RenamePair>>

const KEY_SEPARATOR = '\0'
const MANIFEST_TARGETS = [
  ManifestTarget.Package,
  ManifestTarget.DestructiveChanges,
] as const
const ADD_KINDS = [
  ChangeKind.Add,
  ChangeKind.Modify,
  ChangeKind.Delete,
] as const
const renameKey = (from: string, to: string) => `${from}${KEY_SEPARATOR}${to}`
// Locale-invariant on purpose: Salesforce API names are ASCII and the
// manifest must not depend on the machine that generated it.
// The direction is load-bearing, not a coin flip: upper-casing is not
// injective, so it would merge distinct components (both 'ss' and 'ß' fold
// to 'SS', and 'ff' and 'ﬀ' to 'FF') and suppress a deletion that must
// survive. Lower-casing keeps them apart.
const developerName = (member: string): string =>
  member.slice(member.lastIndexOf(PATH_SEP) + 1).toLowerCase()

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
 * Insertion goes through `ChangeSet.from`, for both handler output and
 * rename triples. Views are pure projections.
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

  static from(
    elements: readonly ManifestElement[],
    renames: readonly RenameTriple[] = []
  ): ChangeSet {
    const set = new ChangeSet()
    for (const element of elements) {
      set._addElement(element)
    }
    for (const { type, from, to } of renames) {
      set._recordRename(type, from, to)
    }
    return set
  }

  // Precise insertion — respects the full (target, changeKind) discriminator.
  // Private: the handler pipeline feeds ManifestElements through `from()`,
  // which is the only remaining caller.
  private _addElement(element: ManifestElement): void {
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

  // Reconstructs the (target, type, member, changeKind) tuples by joining
  // byTarget × byKind on (type, member). Production diff lines never insert the
  // same (type, member) under two different changeKind values, so the join is
  // unambiguous in practice. Most callers use the indexed views
  // (forPackageManifest / forDestructiveManifest / byChangeKind); this method
  // serves the ones that need the full per-element tuples — currently tests
  // listing inserted elements. It is reconstructed on demand rather than
  // maintained as a hot-path structure, so call it once per pass, not per
  // element.
  toElements(): ManifestElement[] {
    return MANIFEST_TARGETS.flatMap(target => this._targetElements(target))
  }

  private _targetElements(target: ManifestTarget): ManifestElement[] {
    return [...this.byTarget[target]].flatMap(([type, members]) =>
      [...members].flatMap(member => this._memberElements(target, type, member))
    )
  }

  private _memberElements(
    target: ManifestTarget,
    type: string,
    member: string
  ): ManifestElement[] {
    const changeKind = ADD_KINDS.find(kind =>
      this.byKind[kind].get(type)?.has(member)
    )
    // Stryker disable next-line ConditionalExpression,ArrayDeclaration -- equivalent: see v8 ignore — the changeKind === undefined branch is unreachable because addElement keeps byTarget and byKind in lockstep
    /* v8 ignore next -- defensive: addElement always pairs byTarget and byKind, so every (type, member) in byTarget has a corresponding byKind entry */
    if (changeKind === undefined) return []
    return [{ target, type, member, changeKind }]
  }

  private _recordRename(type: string, from: string, to: string): void {
    if (from === to) return
    if (!this.renames.has(type)) {
      this.renames.set(type, new Map())
    }
    this.renames.get(type)!.set(renameKey(from, to), { from, to })
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
    const packaged = this.forPackageManifest()
    return this._suppressVersionsOfDeletedBots(
      this._suppressMovedFolderMembers(
        this._subtractByType(baseDeletes, packaged),
        packaged
      )
    )
  }

  // A deleted Bot takes its versions with it, so a BotVersion listed beside
  // its own deleted parent is redundant. A BotVersion member is
  // `<bot>.<version>`, and a Bot API name cannot contain a dot, so the
  // segment before the first one names the parent. Both halves are
  // Salesforce API names, so a bot folder that carries a dot is not
  // deployable source and is not catered for. Only the destructive manifest
  // is filtered: the change-kind review view keeps the version, because that
  // file really was deleted.
  private _suppressVersionsOfDeletedBots(deletes: Manifest): Manifest {
    const bots = deletes.get(BOT_TYPE)
    const versions = deletes.get(BOT_VERSION_TYPE)
    if (!bots?.size || !versions?.size) return deletes

    const kept = new Set(
      [...versions].filter(version => !bots.has(version.split(DOT)[0]!))
    )
    const result = new Map(deletes)
    if (kept.size > 0) {
      result.set(BOT_VERSION_TYPE, kept)
    } else {
      result.delete(BOT_VERSION_TYPE)
    }
    return result
  }

  // For Report/Dashboard, the Metadata API relocates the component when the
  // package lists it under a new folder, so a destructive entry for its
  // former path would delete the component the same deploy just moved.
  // Membership is compared on DeveloperName alone, deliberately not as a
  // rename-pair match, so it also fires in the default run where no rename
  // pair exists.
  private _suppressMovedFolderMembers(
    deletes: Manifest,
    surviving: Manifest
  ): Manifest {
    const result = new Map(deletes)
    for (const type of FOLDER_MOVE_ON_DEPLOY_TYPES) {
      const members = result.get(type)
      const kept = surviving.get(type)
      if (!members || !kept) continue
      // A member whose last segment is empty yields an empty name, which
      // would otherwise match every other malformed member.
      const names = new Set([...kept].map(developerName).filter(Boolean))
      const remaining = new Set(
        [...members].filter(member => !names.has(developerName(member)))
      )
      if (remaining.size > 0) result.set(type, remaining)
      else result.delete(type)
    }
    return result
  }

  // Whether either manifest view would carry at least one member — the
  // "did this run actually produce anything" signal callers need without
  // reaching into both views themselves.
  isEmpty(): boolean {
    return (
      this.forPackageManifest().size === 0 &&
      this.forDestructiveManifest().size === 0
    )
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
    const surviving = this._unionByType([
      this.byKind[ChangeKind.Add],
      this.byKind[ChangeKind.Modify],
    ])
    return {
      [ChangeKind.Add]: this._subtractByType(
        this.byKind[ChangeKind.Add],
        targets
      ),
      // Clone so callers that mutate the returned Modify view cannot corrupt
      // ChangeSet internal state. Add is the new Map returned by
      // _subtractByType, Delete the one returned by
      // _suppressMovedFolderMembers.
      [ChangeKind.Modify]: this._cloneManifest(this.byKind[ChangeKind.Modify]),
      [ChangeKind.Delete]: this._suppressMovedFolderMembers(
        this._subtractByType(
          this.byKind[ChangeKind.Delete],
          this._unionByType([surviving, sources])
        ),
        surviving
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

  // `_recordRename` always inserts at least one pair per type key, so the
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
