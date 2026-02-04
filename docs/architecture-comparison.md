# SDRMetadataAdapter Architecture Comparison

## Approach 1: Static (Current)

```typescript
import { registry } from '@salesforce/source-deploy-retrieve'

// Computed once at module load
const FOLDER_TYPE_IDS = new Set(
  Object.values(registry.types)
    .filter(t => t.inFolder && t.folderType)
    .map(t => t.folderType as string)
)

const EXCLUDED_PARENT_TYPES = new Set(['Translations', 'CustomObjectTranslation'])

export class SDRMetadataAdapter {
  static toInternalMetadata(): Metadata[] {
    const result: Metadata[] = []
    for (const sdrType of Object.values(registry.types)) {
      if (FOLDER_TYPE_IDS.has(sdrType.id)) continue
      result.push(SDRMetadataAdapter.convertType(sdrType))
      // ... children
    }
    return result
  }
}
```

**Test:**
```typescript
jest.resetModules()
jest.doMock('@salesforce/source-deploy-retrieve', () => ({
  registry: { types: mockTypes }
}))
const { SDRMetadataAdapter } = await import('../sdrMetadataAdapter')
const result = SDRMetadataAdapter.toInternalMetadata()
```

---

## Approach 2: Singleton

```typescript
import { registry } from '@salesforce/source-deploy-retrieve'

export class SDRMetadataAdapter {
  private static instance: SDRMetadataAdapter | null = null
  private readonly folderTypeIds: Set<string>
  private readonly excludedParentTypes: Set<string>
  private cachedMetadata: Metadata[] | null = null

  private constructor() {
    this.folderTypeIds = new Set(
      Object.values(registry.types)
        .filter(t => t.inFolder && t.folderType)
        .map(t => t.folderType as string)
    )
    this.excludedParentTypes = new Set(['Translations', 'CustomObjectTranslation'])
  }

  static getInstance(): SDRMetadataAdapter {
    if (!SDRMetadataAdapter.instance) {
      SDRMetadataAdapter.instance = new SDRMetadataAdapter()
    }
    return SDRMetadataAdapter.instance
  }

  // For testing only
  static resetInstance(): void {
    SDRMetadataAdapter.instance = null
  }

  toInternalMetadata(): Metadata[] {
    if (this.cachedMetadata) return this.cachedMetadata

    const result: Metadata[] = []
    for (const sdrType of Object.values(registry.types)) {
      if (this.folderTypeIds.has(sdrType.id)) continue
      result.push(this.convertType(sdrType))
      // ... children
    }
    this.cachedMetadata = result
    return result
  }
}

// Usage
const metadata = SDRMetadataAdapter.getInstance().toInternalMetadata()
```

**Test:**
```typescript
beforeEach(() => {
  jest.resetModules()
  SDRMetadataAdapter.resetInstance()
})

it('test', async () => {
  jest.doMock('@salesforce/source-deploy-retrieve', () => ({
    registry: { types: mockTypes }
  }))
  const { SDRMetadataAdapter } = await import('../sdrMetadataAdapter')
  const result = SDRMetadataAdapter.getInstance().toInternalMetadata()
})
```

---

## Approach 3: Object with Static Local Registry (Hybrid)

```typescript
import { registry as sdrRegistry } from '@salesforce/source-deploy-retrieve'

type Registry = typeof sdrRegistry

export class SDRMetadataAdapter {
  // Static cache - computed once per registry instance
  private static registryCache = new WeakMap<Registry, {
    folderTypeIds: Set<string>
    metadata: Metadata[]
  }>()

  constructor(private readonly registry: Registry = sdrRegistry) {}

  private getOrCreateCache() {
    let cache = SDRMetadataAdapter.registryCache.get(this.registry)
    if (!cache) {
      cache = {
        folderTypeIds: new Set(
          Object.values(this.registry.types)
            .filter(t => t.inFolder && t.folderType)
            .map(t => t.folderType as string)
        ),
        metadata: []
      }
      SDRMetadataAdapter.registryCache.set(this.registry, cache)
    }
    return cache
  }

  toInternalMetadata(): Metadata[] {
    const cache = this.getOrCreateCache()
    if (cache.metadata.length > 0) return cache.metadata

    const result: Metadata[] = []
    for (const sdrType of Object.values(this.registry.types)) {
      if (cache.folderTypeIds.has(sdrType.id)) continue
      result.push(this.convertType(sdrType))
      // ... children
    }
    cache.metadata = result
    return result
  }

  // For testing - clear cache
  static clearCache(): void {
    SDRMetadataAdapter.registryCache = new WeakMap()
  }
}

// Usage - default registry
const metadata = new SDRMetadataAdapter().toInternalMetadata()
```

**Test:**
```typescript
beforeEach(() => {
  SDRMetadataAdapter.clearCache()
})

it('test', () => {
  const mockRegistry = { types: mockTypes }
  const adapter = new SDRMetadataAdapter(mockRegistry)
  const result = adapter.toInternalMetadata()
  // No jest.resetModules() needed!
})
```

---

## Approach 4: Full Dynamic (Recompute Each Time)

```typescript
import { registry as sdrRegistry } from '@salesforce/source-deploy-retrieve'

type Registry = typeof sdrRegistry

export class SDRMetadataAdapter {
  constructor(private readonly registry: Registry = sdrRegistry) {}

  private computeFolderTypeIds(): Set<string> {
    return new Set(
      Object.values(this.registry.types)
        .filter(t => t.inFolder && t.folderType)
        .map(t => t.folderType as string)
    )
  }

  toInternalMetadata(): Metadata[] {
    const folderTypeIds = this.computeFolderTypeIds()
    const excludedParentTypes = new Set(['Translations', 'CustomObjectTranslation'])

    const result: Metadata[] = []
    for (const sdrType of Object.values(this.registry.types)) {
      if (folderTypeIds.has(sdrType.id)) continue
      result.push(this.convertType(sdrType, excludedParentTypes))
      // ... children
    }
    return result
  }
}

// Usage
const metadata = new SDRMetadataAdapter().toInternalMetadata()
```

**Test:**
```typescript
it('test', () => {
  const mockRegistry = { types: mockTypes }
  const adapter = new SDRMetadataAdapter(mockRegistry)
  const result = adapter.toInternalMetadata()
  // Simplest test setup!
})
```

---

## Comparison Matrix

| Criteria | Static | Singleton | Hybrid (Object + Cache) | Full Dynamic |
|----------|--------|-----------|------------------------|--------------|
| **Code Complexity** | ⭐ Simple | ⭐⭐ Moderate | ⭐⭐⭐ Complex | ⭐ Simple |
| **Test Setup** | ⭐⭐⭐ Complex | ⭐⭐ Moderate | ⭐ Simple | ⭐ Simplest |
| **Performance** | ⭐ Best | ⭐ Best | ⭐ Best (cached) | ⭐⭐⭐ Worst |
| **Memory** | ⭐ Minimal | ⭐⭐ Low | ⭐⭐ Low | ⭐ Minimal (no cache) |
| **Flexibility** | ⭐⭐⭐ None | ⭐⭐ Low | ⭐ High | ⭐ Highest |
| **Predictability** | ⭐ High | ⭐⭐ Moderate | ⭐⭐ Moderate | ⭐ Highest |

### Detailed Scores

#### Code Complexity
- **Static**: No classes to instantiate, just call static methods
- **Singleton**: getInstance() pattern, reset method for tests
- **Hybrid**: WeakMap cache, constructor injection, cache management
- **Full Dynamic**: Simple class, no state management

#### Test Setup Complexity
- **Static**: Requires `jest.resetModules()` + `jest.doMock()` + dynamic import
- **Singleton**: Requires `resetInstance()` + module mocking
- **Hybrid**: Just pass mock to constructor, optional cache clear
- **Full Dynamic**: Just pass mock to constructor, no state to manage

#### Runtime Performance (called once at startup)
- **Static**: Computed at module load, O(1) access
- **Singleton**: Lazy init on first call, then O(1)
- **Hybrid**: First call computes + caches, then O(1)
- **Full Dynamic**: Recomputes on every call, O(n) each time

#### Memory Usage
- **Static**: One copy in module scope
- **Singleton**: One instance + cached result
- **Hybrid**: WeakMap allows GC of unused registries
- **Full Dynamic**: No persistent state, but creates new Sets each call

#### Flexibility (swapping registries)
- **Static**: Cannot swap without module mocking
- **Singleton**: Cannot swap easily (tied to module import)
- **Hybrid**: Pass any registry to constructor
- **Full Dynamic**: Pass any registry to constructor

---

## Recommendation

Given that `toInternalMetadata()` is called **once at application startup**:

| If you prioritize... | Choose |
|---------------------|--------|
| **Simplicity** | Static (current) or Full Dynamic |
| **Testability** | Hybrid or Full Dynamic |
| **Performance** | Static, Singleton, or Hybrid |
| **Best balance** | **Hybrid** - injectable, cached, testable |

### Why Hybrid Is Best (Implemented)

```typescript
// Production: uses default SDR registry, computed once
const metadata = new SDRMetadataAdapter().toInternalMetadata()

// Test: simple injection, no module mocking
const adapter = new SDRMetadataAdapter(mockRegistry)
expect(adapter.toInternalMetadata()).toEqual(expected)
```

The Hybrid approach gives you:
- ✅ Dependency injection for tests
- ✅ Caching for performance
- ✅ No `jest.resetModules()` complexity
- ✅ WeakMap allows garbage collection
- ⚠️ More code than Static, but cleaner tests

### Why Static Was Replaced

While the Static approach was a valid pragmatic choice, the Hybrid approach was selected for:
- ✅ Cleaner, more maintainable tests without `jest.resetModules()` complexity
- ✅ Better adherence to Dependency Inversion Principle
- ✅ Same performance through caching
- ✅ Improved testability for future development

**Status: Hybrid approach implemented** (see `src/metadata/sdrMetadataAdapter.ts`)
