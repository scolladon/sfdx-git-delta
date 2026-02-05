# SGD Refactoring Plan

## Overview
This plan covers code quality improvements identified during codebase review.

---

## Phase 1: Remove Dead Code (v57-v66 files)
**Status:** Pending
**Commit:** Dedicated

### Tasks
- [ ] Delete `src/metadata/v57.ts`
- [ ] Delete `src/metadata/v58.ts`
- [ ] Delete `src/metadata/v59.ts`
- [ ] Delete `src/metadata/v60.ts`
- [ ] Delete `src/metadata/v61.ts`
- [ ] Delete `src/metadata/v62.ts`
- [ ] Delete `src/metadata/v63.ts`
- [ ] Delete `src/metadata/v64.ts`
- [ ] Delete `src/metadata/v65.ts`
- [ ] Delete `src/metadata/v66.ts`
- [ ] Remove stale comment in `src/metadata/sdrMetadataAdapter.ts:26`
- [ ] Run tests to verify nothing breaks
- [ ] Commit: `chore: remove unused metadata version files (v57-v66)`

---

## Phase 2: Add Logging in Error Situations
**Status:** Pending
**Commit:** Dedicated

### Analysis Required
Identify all catch blocks that swallow errors without logging.

### Known Locations
- [ ] `src/service/standardHandler.ts:75-80` - warnings.push without logging
- [ ] Search for other `catch` blocks missing logging

### Implementation
- Use `Logger.warn()` if adding in warnings, with lazy template
- Use `Logger.error()` if throwing, with lazy template
- Preserve stack trace with `Error.cause`
- Pattern:
  ```typescript
  } catch (error) {
    if (error instanceof Error) {
      Logger.warn(lazy`${context}: ${error.message}`)
      this.warnings.push(new Error(`${context}: ${error.message}`, { cause: error }))
    }
  }
  ```

---

## Phase 3: Zod Schema for Type Definitions
**Status:** ✅ DONE
**Type:** Refactor
**Commit:** `ea5c66f`

### Current State
- Types defined in `src/types/metadata.ts` (28 lines)
- Zod schemas defined in `src/metadata/metadataManager.ts:16-40`
- **Duplication exists** - schemas and types define same structure separately

### Evaluation Findings

#### Benefits Confirmed
| Benefit | Details |
|---------|---------|
| Single source of truth | `z.infer<typeof Schema>` derives types automatically |
| No sync issues | Change schema → type updates automatically |
| Runtime + compile safety | Same definition for both validation layers |
| Better errors | Zod provides paths: `content[0].suffix: Expected string` |
| Composition | `.extend()`, `.merge()`, `.pick()` work naturally |

#### Concerns Addressed
| Concern | Finding |
|---------|---------|
| Performance | Negligible - only parse at boundaries (file load) |
| Type compatibility | `z.infer` produces flat types (functionally equivalent) |
| Migration complexity | Low - straightforward refactor |

#### Implementation Approach
```typescript
// src/schemas/metadata.ts (NEW)
const BaseMetadataSchema = z.object({
  suffix: z.string().optional(),
  xmlName: z.string().optional(),
})

const MetadataSchema = BaseMetadataSchema
  .extend({ content: z.array(BaseMetadataSchema).optional() })
  .extend({ parentXmlName: z.string().optional(), /* ... */ })
  .extend({ directoryName: z.string(), inFolder: z.boolean(), /* ... */ })
  .strict()

// Export both schema AND inferred type
export { MetadataSchema }
export type Metadata = z.infer<typeof MetadataSchema>
```

#### Migration Steps
1. Create `src/schemas/metadata.ts` with Zod schemas
2. Export schemas AND inferred types
3. Update imports in `metadataManager.ts` (remove local schemas)
4. Update imports in consumers (`types/metadata.ts` → `schemas/metadata.ts`)
5. Delete `src/types/metadata.ts` or convert to re-exports

### Implementation Complete
- Created `src/schemas/metadata.ts` with Zod schemas
- Types derived via `z.infer<>` - no duplication
- `src/types/metadata.ts` now re-exports from schemas (backward compatible)
- All 13 importing files continue to work without changes

---

## Phase 4: MetadataDiff.ts Deep Analysis & Refactoring
**Status:** ✅ DONE
**Type:** Incremental improvements

### Deep Analysis Summary

The file contains **4 classes** in **329 lines**:
- `MetadataDiff` (lines 37-85): Orchestrator - compares and prunes XML metadata
- `MetadataExtractor` (lines 87-137): Extracts typed elements from XML content
- `MetadataComparator` (lines 139-211): Computes added/deleted manifest entries
- `JsonTransformer` (lines 213-328): Generates pruned JSON for deployment

---

### 1. MAINTENANCE Analysis (Simplicity of Understanding)

| Issue | Location | Severity | Description |
|-------|----------|----------|-------------|
| **Temporal Coupling** | MetadataDiff:50-84 | 🔴 High | `prune()` MUST be called after `compare()`. Hidden contract - `toContent`/`fromContent` are set by compare and silently used by prune. Calling prune() first = undefined behavior. |
| **Magic Strings** | lines 17-18 | 🟡 Medium | `<array>` and `<object>` are domain-specific markers. Meaning unclear without context. Why these strings? What do they represent? |
| **Mutable State** | JsonTransformer:214 | 🟡 Medium | `isEmpty` flag mutated via `checkEmpty()` across multiple methods. Flow is hard to trace. |
| **Implicit Dependencies** | MetadataDiff:38-39 | 🟡 Medium | `toContent!` and `fromContent!` use definite assignment assertion (`!`). Runtime bomb if misused. |
| **Multiple Classes** | entire file | 🟢 Low | 4 classes is acceptable, they are cohesive. But file is 329 lines - borderline. |

**Key Insight**: The temporal coupling is the most dangerous issue. A developer unfamiliar with the code could easily:
```typescript
// BUG: prune() reads undefined toContent/fromContent
const { xmlContent } = metadataDiff.prune()
const { added } = await metadataDiff.compare(path)
```

---

### 2. SOLID Principles Analysis

#### Single Responsibility Principle (SRP)
| Class | Responsibilities | Verdict |
|-------|-----------------|---------|
| MetadataDiff | 1) Load content 2) Delegate comparison 3) Delegate pruning 4) Store state | 🟡 Too many - state management mixed with orchestration |
| MetadataExtractor | Extract XML elements, cache selectors | ✅ Good |
| MetadataComparator | Compute manifest diffs | ✅ Good |
| JsonTransformer | Generate partial JSON, track emptiness | 🟡 Two concerns mixed |

#### Open/Closed Principle (OCP)
```typescript
// lines 263-271 - VIOLATION
if (isUndefined(keyField)) {
  result = this.getPartialContentWithoutKey(fromMeta, toMeta)
} else if (keyField === ARRAY_SPECIAL_KEY) {
  result = this.getPartialContentForArray(fromMeta, toMeta)
} else if (keyField === OBJECT_SPECIAL_KEY) {
  result = this.getPartialContentForObject(fromMeta, toMeta)
} else {
  result = this.getPartialContentWithKey(fromMeta, toMeta, keyField)
}
```
Adding a new key matching strategy requires modifying this if/else chain.

**However**: Only 4 cases, stable domain. Strategy pattern may be over-engineering.

#### Dependency Inversion Principle (DIP)
- MetadataDiff creates MetadataExtractor in constructor ✅ (injected to comparator/transformer)
- MetadataComparator receives extractor via constructor ✅
- JsonTransformer receives extractor via constructor ✅
- **No interfaces** - tight coupling to concrete classes 🟡

---

### 3. PERFORMANCE Analysis

#### Critical: O(n×m) in MetadataComparator

```typescript
// lines 193-201 - compareAdded
private compareAdded = (meta: XmlContent[], keySelector: KeySelectorFn, elem: XmlContent) => {
  const elemKey = keySelector(elem)
  const match = meta.find(el => keySelector(el) === elemKey)  // O(n) per call!
  return !match || !deepEqual(match, elem)
}

// lines 203-210 - compareDeleted
private compareDeleted = (meta: XmlContent[], keySelector: KeySelectorFn, elem: XmlContent) => {
  const elemKey = keySelector(elem)
  return !meta.some(el => keySelector(el) === elemKey)  // O(n) per call!
}
```

**Impact**: For each element in `baseMeta` (m elements), we scan `targetMeta` (n elements).
- Time complexity: **O(n × m)**
- With 5000 elements each: 25,000,000 comparisons

**Contrast with JsonTransformer** (already optimized):
```typescript
// line 312 - O(n) map construction, O(1) lookups
const fromMap = new Map(fromMeta.map(item => [keySelector(item), item]))
```

#### Benchmark Data (from test file, 5000 elements)
The performance test exists but is skipped. Current implementation likely takes seconds for large files.

---

### Prioritized Refactoring Tasks

#### Priority 1: Fix O(n×m) Performance (High Impact, Low Risk)
- [x] **4.1** Pre-compute lookup Map in `MetadataComparator`
  - Current: `find()`/`some()` is O(n) per element = O(n×m) total
  - Fix: Build `Map<key, element>` once in `compare()`, pass to matchers
  - Impact: O(n×m) → O(n+m)
  - Risk: Low - localized change, existing tests cover behavior
  - Lines: 146-210

#### Priority 2: Remove Temporal Coupling (High Impact, Medium Risk)
- [x] **4.2** Make `prune()` independent of `compare()`
  - **Option A** (Implemented): Load content in `compare()`, return it along with diff, pass to `prune()`
    ```typescript
    // New signature
    async compare(path: string): Promise<{ added, deleted, toContent, fromContent }>
    prune(toContent: XmlContent, fromContent: XmlContent): PrunedContent
    ```
  - Risk: Medium - API change affects InFileHandler
  - Lines: 37-85

#### Priority 3: Reduce Mutable State (Medium Impact, Low Risk)
- [x] **4.3** Replace `JsonTransformer.isEmpty` mutable flag
  - Current: Mutated during traversal via `checkEmpty()`
  - Fix: Return `{ content, hasChanges }` from each method, aggregate at top
  - Benefit: Pure functions, easier to reason about
  - Risk: Low - internal refactor, doesn't change public API
  - Lines: 213-328

#### Priority 4: Document Magic Strings (Low Impact, Low Risk)
- [x] **4.4** Add documentation for `<array>` and `<object>` markers
  - Current: Meaning is unclear without domain knowledge
  - Fix: Add JSDoc explaining each strategy's purpose
  - Risk: Very low - documentation only
  - Lines: 17-18

#### Priority 5: Strategy Pattern (Low Impact, High Risk) - SKIP
- [ ] ~~**4.5** Replace magic strings with strategy pattern~~
  - **Recommendation: SKIP** - Over-engineering for 4 stable cases
  - Current if/else is clear enough, domain is stable
  - Cost exceeds benefit

---

### Implementation Order

| Order | Task | Effort | Test Changes |
|-------|------|--------|--------------|
| 1 | 4.1 Performance fix | 30 min | None - existing tests cover |
| 2 | 4.2 Remove temporal coupling | 1 hour | Update InFileHandler usage |
| 3 | 4.3 Reduce mutable state | 45 min | None - internal refactor |
| 4 | 4.4 Document magic strings | 15 min | None |

### Usage Pattern (from InFileHandler)
```typescript
// Current usage (lines 49-52 of inFileHandler.ts)
const { added, deleted } = await this.metadataDiff.compare(this.line)
this._storeComparison(this.diffs.destructiveChanges, deleted)
this._storeComparison(this.diffs.package, added)
const { xmlContent, isEmpty } = this.metadataDiff.prune()
```
Note: `compare()` and `prune()` are always called together, in order.

---

## Progress Tracking

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Remove dead code | ✅ Done |
| 2 | Add error logging | ✅ Done |
| 3 | Zod-based types | ✅ Done |
| 4.1 | Performance fix (O(n×m) → O(n+m)) | ✅ Done |
| 4.2 | Remove temporal coupling | ✅ Done |
| 4.3 | Reduce mutable state | ✅ Done |
| 4.4 | Document magic strings | ✅ Done |
| 4.5 | Strategy pattern | ❌ Skipped (over-engineering) |

---

## Session Notes

_Add notes here as we work through the plan_
