'use strict'

import { parse } from 'node:path/posix'

import {
  DOT,
  EXTENSION_SUFFIX_REGEX,
  PATH_SEP,
} from '../constant/fsConstants.js'
import { GIT_DIFF_TYPE_REGEX } from '../constant/gitConstants.js'
import {
  CONTENT_CONTAINER_ADAPTERS,
  CUSTOM_APPLICATION_SUFFIX,
  CUSTOM_METADATA_SUFFIX,
  DEFAULT_CONTAINER_DEPTH,
  DIGITAL_EXPERIENCE_ADAPTER,
  DIGITAL_EXPERIENCE_BUNDLE_DEPTH,
  DIGITAL_EXPERIENCE_CONTENT_DEPTH,
  EMAIL_SERVICES_FUNCTION_SUFFIX,
  INFOLDER_SUFFIX_REGEX,
  META_REGEX,
  METAFILE_SUFFIX,
  OBJECT_TRANSLATION_TYPE,
  OBJECT_TYPE,
  PERMISSIONSET_TYPE,
  SHARING_RULE_TYPE,
  SUB_OBJECT_TYPES,
  VIRTUAL_BOT_TYPE,
  WORKFLOW_TYPE,
} from '../constant/metadataConstants.js'
import type { Metadata } from '../types/metadata.js'
import { log } from '../utils/LoggingDecorator.js'
import { MetadataRepository } from './MetadataRepository.js'

// Callers hand over a git diff line as readily as a bare path, and the
// status prefix rides on the first segment — which is exactly where a
// repository laid out at its own root keeps the type directory — so nothing
// may compare segments before this has run.
const asFilePath = (path: string): string =>
  path.replace(GIT_DIFF_TYPE_REGEX, '')

export class MetadataRepositoryImpl implements MetadataRepository {
  protected readonly metadataPerExt: Map<string, Metadata>
  protected readonly metadataPerDir: Map<string, Metadata>
  protected readonly metadataPerXmlName: Map<string, Metadata>
  // Memoizes get(path) results across the registry's lifetime. The lookup
  // chain (split + extension + directory walk) is deterministic in `path`
  // and the registry is read-only after construction, so a single cache
  // here is safe and frees every consumer (has, getFullyQualifiedName,
  // TypeHandlerFactory, computeTreeIndexScope, the RepoGitDiff filter
  // chain) from repeating the work. Stores `undefined` negatives too —
  // distinguished from "uncached" via .has().
  private readonly pathCache: Map<string, Metadata | undefined> = new Map()
  // A suffix declared by more than one type is ambiguous for this registry only.
  // Kept per instance rather than shared across the process, so a registry
  // built from an additional user-supplied file cannot make an extension
  // unsafe for every registry built after it.
  private readonly unsafeExtensions = new Set<string>([
    CUSTOM_APPLICATION_SUFFIX,
    EMAIL_SERVICES_FUNCTION_SUFFIX,
    CUSTOM_METADATA_SUFFIX,
  ])

  constructor(protected readonly metadatas: Metadata[]) {
    this.metadataPerExt = new Map<string, Metadata>()
    this.metadataPerDir = new Map<string, Metadata>()
    this.metadataPerXmlName = new Map<string, Metadata>()

    this.metadatas.forEach(metadata => {
      this.addSuffix(metadata)
      this.addFolder(metadata)
      this.addXmlName(metadata)
    })
  }

  protected addSuffix(metadata: Metadata) {
    this.registerSuffix(metadata)
    this.addSharedFolderSuffix(metadata)
  }

  // Content clones must register through here, not through addSuffix: a clone
  // keeps the same content[] as its source (see addSharedFolderSuffix below),
  // so routing it back through addSuffix would re-enter addSharedFolderSuffix
  // on that same content[] and recurse forever.
  private registerSuffix(metadata: Metadata) {
    // Stryker disable next-line ConditionalExpression -- equivalent: suffix presence guard; flipping to false lets a suffix-less entry reach the Map.has lookup on undefined, which returns false and falls into metadataPerExt.set under an undefined key — a stray entry no test path queries by undefined suffix (the true flip registers nothing and is killed by the suite)
    if (!metadata.suffix) return
    if (this.metadataPerExt.has(metadata.suffix)) {
      this.unsafeExtensions.add(metadata.suffix)
      return
    }
    this.metadataPerExt.set(metadata.suffix, metadata)
  }

  // content is kept on the clone (not stripped) because it is what tells the
  // rest of the registry — ownsNestedPaths, via declaresNestedContent — that
  // this suffix's type owns every path nested below the shared directory,
  // not just the file itself. Dropping it here would make a component
  // resolved through its content suffix indistinguishable from a type with no
  // nested content, losing the folder segment that tells same-named
  // components under different folders apart.
  protected addSharedFolderSuffix(metadata: Metadata) {
    if (!metadata.content) return
    for (const sharedFolderMetadataDef of metadata.content) {
      this.registerSuffix({
        ...metadata,
        suffix: sharedFolderMetadataDef.suffix,
      })
    }
  }

  protected addFolder(metadata: Metadata) {
    // Stryker disable next-line ConditionalExpression -- equivalent: directoryName presence guard; same rationale as addSuffix — flipping to true sets the map with undefined key which no test path queries
    if (metadata.directoryName) {
      this.metadataPerDir.set(metadata.directoryName, metadata)
    }
  }

  protected addXmlName(metadata: Metadata) {
    // Stryker disable next-line ConditionalExpression -- equivalent: xmlName presence guard; same rationale as above
    if (metadata.xmlName) {
      this.metadataPerXmlName.set(metadata.xmlName, metadata)
    }
  }

  public has(path: string): boolean {
    return !!this.get(path)
  }

  public get(path: string): Metadata | undefined {
    return this.resolve(asFilePath(path))
  }

  // Split out of get() so the key rule, which already holds the stripped
  // path, resolves it without stripping twice; every other caller goes
  // through get() and its single strip.
  private resolve(filePath: string): Metadata | undefined {
    // Stryker disable next-line ConditionalExpression -- equivalent: cache short-circuit; flipping to false re-runs the search chain which is deterministic in path, so the result is identical
    if (this.pathCache.has(filePath)) return this.pathCache.get(filePath)
    const parts = filePath.split(PATH_SEP)
    const result =
      this.searchByExtension(parts) ?? this.searchByDirectory(parts)
    this.pathCache.set(filePath, result)
    return result
  }

  protected searchByExtension(parts: string[]): Metadata | undefined {
    const extension = parse(
      parts[parts.length - 1].replace(METAFILE_SUFFIX, '')
    ).ext.replace(DOT, '')

    if (this.unsafeExtensions.has(extension)) {
      return
    }
    return this.metadataPerExt.get(extension)
  }

  protected searchByDirectory(parts: string[]): Metadata | undefined {
    let metadata: Metadata | undefined
    for (const part of parts) {
      const found = this.metadataPerDir.get(part)
      if (found) {
        metadata = found
        // Stop at any type that owns every path nested below its directory, so
        // a deeper folder matching another type's directoryName (e.g. an
        // `icons/` folder inside a StaticResource) cannot override it.
        if (this.ownsNestedPaths(found)) break
      }
    }
    return metadata
  }

  // A type owns its nested paths when it is folder-organized (`inFolder`, e.g.
  // Report/Dashboard), an SDR content container (adapter bundle/
  // digitalExperience/mixedContent, e.g. LWC/StaticResource), or declares its
  // own suffix-keyed nested content (Wave/Bot/Discovery/Moderation). In each
  // case the segments below its directory are user-named content, not metadata
  // directories.
  protected ownsNestedPaths(metadata: Metadata): boolean {
    return (
      metadata.inFolder ||
      this.isContentContainer(metadata) ||
      this.declaresNestedContent(metadata)
    )
  }

  // Extracted so componentScopedName can pick a container's nesting depth
  // from its adapter without re-deriving what counts as a container.
  private isContentContainer(
    metadata: Metadata
  ): metadata is Metadata & { adapter: string } {
    // Stryker disable next-line ConditionalExpression -- equivalent: Set.has(undefined) is already false, so the `!== undefined` operand changes no runtime outcome; it exists only to narrow string|undefined → string for the Set<string>.has call under strict mode
    return (
      metadata.adapter !== undefined &&
      CONTENT_CONTAINER_ADAPTERS.has(metadata.adapter)
    )
  }

  // A type declares nested content when its `content[]` lists suffix-keyed
  // sub-types sharing one directory (Wave/Bot/Discovery/Moderation): the
  // segments below that directory are then user-named content, not metadata
  // directories, so the walk must stop here. A non-empty `content[]` is the
  // whole test — it is exactly what separates these containers from a
  // decomposed `CustomObject`, whose empty `content[]` signals that its
  // children ARE deeper metadata directories (`fields/`, `listViews/`, …) the
  // walk must keep descending into. `metaFile` is deliberately not checked:
  // every registry type carrying a non-empty `content[]` owns its nested paths
  // (the folder-organized ones — Dashboard/Report/EmailTemplate — also satisfy
  // it but already stop via the `inFolder` arm above). The "empty content keeps
  // descending" branch is covered by the existing non-container nested-folder
  // test (a class file under a colliding `icons/` directory).
  private declaresNestedContent(metadata: Metadata): boolean {
    return (metadata.content?.length ?? 0) > 0
  }

  public getByXmlName(xmlName: string): Metadata | undefined {
    return this.metadataPerXmlName.get(xmlName)
  }

  @log
  public getFullyQualifiedName(path: string): string {
    const filePath = asFilePath(path)
    const type = this.resolve(filePath)
    if (!type) return parse(filePath).base
    if (MetadataRepositoryImpl.HOLDER_SCOPED_COMPOSED_TYPES.has(type.xmlName!))
      return this.holderScopedName(filePath, type)
    if (MetadataRepositoryImpl.COMPOSED_TYPES.has(type.xmlName!))
      return this.composedTypeName(filePath)
    if (!this.ownsNestedPaths(type)) return this.plainTypeName(filePath, type)
    return this.componentScopedName(filePath, type)
  }

  // The type directory leads a plain key because a suffix belongs to no
  // single type (`policy`, `settings`, `site`, `rule` are each declared by
  // several) — it is the registry's directory, not the file's own, which is
  // what lets a component moved between package directories key the same.
  // Four live registry entries (AssignmentRule, AutoResponseRule,
  // EscalationRule, ManagedTopic) carry a suffix and no directory: the key
  // must never read `undefined/…`.
  private plainTypeName(path: string, type: Metadata): string {
    const fileName = parse(path).base.replace(META_REGEX, '')
    return type.directoryName ? `${type.directoryName}/${fileName}` : fileName
  }

  // Anchored segment-wise on the first registry directory in the path: a
  // substring search would also hit an unrelated directory that merely
  // contains that name (`objects_backup/objects/…`) and drag it into the key.
  // With no such segment findIndex answers -1 and slice(-1) keeps only the
  // file name, so the fallback every other arm spells out needs no branch.
  private composedTypeName(path: string): string {
    const parts = path.split(PATH_SEP)
    const typeIndex = parts.findIndex(part => this.metadataPerDir.has(part))
    return parts.slice(typeIndex).join('')
  }

  // Depth 1 handles every decomposed spelling a holder can appear under: a
  // single file directly beneath its type directory, or a child file nested
  // several segments down — both collapse to the same one-segment container
  // name, because the holder is one component regardless of how SFDX
  // decomposed it into files.
  private holderScopedName(path: string, type: Metadata): string {
    const parts = path.split(PATH_SEP)
    const typeIndex = parts.lastIndexOf(type.directoryName!)
    if (typeIndex === -1) return parse(path).base
    return this.containerName(parts, typeIndex, DEFAULT_CONTAINER_DEPTH)
  }

  // inFolder is checked before the container check because a type can be
  // both inFolder and a content container (Document): adapter-first would
  // truncate every Document to its folder, discarding the varying-extension
  // files that folder owns.
  private componentScopedName(path: string, type: Metadata): string {
    const parts = path.split(PATH_SEP)
    const typeIndex = parts.lastIndexOf(type.directoryName!)
    if (typeIndex === -1) return parse(path).base
    if (type.inFolder) return this.folderScopedName(parts, typeIndex)
    if (this.isContentContainer(type)) {
      const nestedCount = parts.length - typeIndex - 1
      const depth = this.containerDepth(type.adapter, nestedCount)
      return this.containerName(parts, typeIndex, depth)
    }
    return this.nestedContentName(parts, typeIndex, type)
  }

  // The `-meta.xml` companion sits outside the extension
  // (`logo.png-meta.xml`), so it must fall away before the extension strip
  // runs — the reverse order would leave it attached and never removed.
  // The trailing `Folder` strip mirrors the folder handler's own name
  // derivation, so the key cannot disagree with the descriptor for a name
  // that happens to end in Folder.
  private folderScopedName(parts: string[], typeIndex: number): string {
    return parts
      .slice(typeIndex)
      .join(PATH_SEP)
      .replace(META_REGEX, '')
      .replace(INFOLDER_SUFFIX_REGEX, '')
      .replace(EXTENSION_SUFFIX_REGEX, '')
  }

  // A flat nested-content directory tells its families apart by extension
  // (`wave/A.wdash` vs `wave/A.wapp`), so the extension is kept and any
  // sub-directory is discarded, matching the descriptor. A
  // FOLDER_SCOPED_TYPES member (VirtualBot) is instead named
  // `<bot>.<version>` and needs every segment from the type directory down.
  private nestedContentName(
    parts: string[],
    typeIndex: number,
    type: Metadata
  ): string {
    const tail = MetadataRepositoryImpl.FOLDER_SCOPED_TYPES.has(type.xmlName!)
      ? parts.slice(typeIndex)
      : [parts[typeIndex], parts.at(-1)]
    return tail.join(PATH_SEP).replace(META_REGEX, '')
  }

  // A deeper remainder means the container is named by a directory, and a
  // directory name is the component's whole name — stripping it would
  // corrupt one that merely contains a dot (`lwc/foo.bar/…`). Only when the
  // taken segments consume the whole remainder is the name actually a file,
  // and only then are `-meta.xml` and the extension noise to strip away.
  private containerName(
    parts: string[],
    typeIndex: number,
    depth: number
  ): string {
    const nested = parts.slice(typeIndex + 1)
    const name = [parts[typeIndex], ...nested.slice(0, depth)].join(PATH_SEP)
    return depth >= nested.length
      ? name.replace(META_REGEX, '').replace(EXTENSION_SUFFIX_REGEX, '')
      : name
  }

  // Only digitalExperience varies by depth: a page content file lives
  // DIGITAL_EXPERIENCE_CONTENT_DEPTH segments below the bundle directory,
  // while the bundle itself and any shallower/non-canonical layout share the
  // coarser DIGITAL_EXPERIENCE_BUNDLE_DEPTH. Every other content-container
  // adapter names its component by the single segment below its directory.
  private containerDepth(adapter: string, nestedCount: number): number {
    if (adapter !== DIGITAL_EXPERIENCE_ADAPTER) return DEFAULT_CONTAINER_DEPTH
    return nestedCount > DIGITAL_EXPERIENCE_CONTENT_DEPTH
      ? DIGITAL_EXPERIENCE_CONTENT_DEPTH
      : DIGITAL_EXPERIENCE_BUNDLE_DEPTH
  }

  public values(): Metadata[] {
    return this.metadatas
  }

  private static COMPOSED_TYPES = new Set([
    OBJECT_TYPE,
    OBJECT_TRANSLATION_TYPE,
    PERMISSIONSET_TYPE,
    WORKFLOW_TYPE,
    SHARING_RULE_TYPE,
    ...SUB_OBJECT_TYPES,
  ])

  // A subset of COMPOSED_TYPES: PermissionSet and CustomObjectTranslation
  // decompose into per-file children like every other composed type, but
  // (unlike CustomObject/Workflow/SharingRules) their children are not
  // distinct components — every file under one holder is the same
  // PermissionSet or CustomObjectTranslation, so they key on the holder
  // instead of the decomposed path.
  private static HOLDER_SCOPED_COMPOSED_TYPES = new Set([
    PERMISSIONSET_TYPE,
    OBJECT_TRANSLATION_TYPE,
  ])

  // Nested-content families sharing one flat directory are told apart by
  // extension, except VirtualBot: a BotVersion member is `<bot>.<version>`,
  // so its key must keep the bot folder that the extension alone would lose.
  private static FOLDER_SCOPED_TYPES = new Set([VIRTUAL_BOT_TYPE])
}
