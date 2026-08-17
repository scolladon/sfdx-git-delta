# Migrating: `Config.mergeBase` is now required

The `--merge-base` feature adds one field to the `Config` type: `mergeBase: boolean`. It is **required**, not optional.

> [!NOTE]
> **CLI users are not affected.** `sf sgd source delta` sets the field for you from the `--merge-base` / `-b` flag. This page is only for projects that import the module and call it from their own Node application.

## Who needs to change something

Only **TypeScript** consumers of the programmatic API:

```ts
import sgd from 'sfdx-git-delta'

const work = await sgd({ /* ... */ })
```

After upgrading, `tsc` reports the new field as missing. JavaScript consumers see no error and no behavior change.

## The fix

Add `mergeBase: false` to the config object you pass in:

```diff
 const work = await sgd({
   to: 'HEAD',
   from: 'origin/main',
+  mergeBase: false, // resolve `from` as the merge base of `from` and `to`
   output: './output',
   repo: '.',
   source: ['.'],
   generateDelta: false,
   ignoreWhitespace: false,
 })
```

`mergeBase: false` is exactly today's behavior: `from` is used as given. Setting it to `true` resolves `from` to the merge base of `from` and `to` — the equivalent of `git diff from...to` (three-dot, common-ancestor semantics), without shelling out to a `git` binary.

## Why required rather than optional

`Config` already models its other booleans as required — `generateDelta` and `ignoreWhitespace` are both non-optional. Making `mergeBase` optional would have made it the only tri-state flag in the type (`true` / `false` / absent), and every reader would have had to decide what absent means. A required boolean keeps one meaning per value and makes the compiler tell you where to look.

**Runtime behavior is unchanged.** The field is only read in one place, and an absent value is falsy — so a JavaScript caller that never sets it behaves exactly as before. This is a compile-time break only.

## If you would rather not adapt yet

The plugin publishes release channels, so you can pin until you are ready:

```sh
# stay on the previously validated release
sf plugins install sfdx-git-delta@stable
```

For a library dependency, pin the exact version in your `package.json` and upgrade when it suits you. Nothing about the older behavior is deprecated by this change.

## See also

- [`--merge-base` usage and the CI/CD caveats](../README.md#cicd-specificity) — shallow clones and the GitHub Actions `pull_request` merge-commit trap are both worth reading before you enable the flag in a pipeline.
