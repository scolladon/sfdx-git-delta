# Migrating to `v6.0.0`

Version `v6.0.0` brings the plugin into the **sf plugin v2 architecture**, which offers significant improvements in performance, maintainability, and security. While the upgrade comes with benefits, it also introduces some new behaviors and potential breaking changes. Versions `v5.x` and below will no longer be maintained (_no bug fixes, no new metadata support, no API version updates, and no new features_).

## New Behaviors

- [Deprecated parameters](#deprecated-parameters)
- [Improved error handling for file and dir parameters](#param-error)

## Breaking Changes

- [sfdx/cli no longer supported](#drop-old-cli)
- [Plugin output format changes](#default-output)
- [Streamlined JSON output](#json-output)
- [Switch to ES modules (no more CommonJS)](#export-module)
- [API version format](#api-version-format)
- [Setting LogLevel](#setting-log-level)

## Installation Details

`sfdx-git-delta` `v6.x` follows a new release channel structure:

- **`latest-rc`**: Contains the **latest fixes and features** that have passed automated testing, but still await customer validation.
- **`latest`**: This channel has **been validated by real-world usage** and is stable for most users.
- **`stable`**: Represents the **last fully stable release**, typically for versions with 50k+ downloads.

> [!NOTE]
> If you’ve been installing the plugin using these channels and are not impacted by `v6` breaking changes, this transition should be seamless.


```sh
# install latest-rc

sf plugins install sfdx-git-delta@latest-rc

# install latest

sf plugins install sfdx-git-delta@latest
# or
sf plugins install sfdx-git-delta

# install stable

sf plugins install sfdx-git-delta@stable
```

### Legacy version installation

If you need more time to adapt to version `v6.x`, the previous `v5.x` version is still available via the `stable` channel (for now), the `legacy` channel and via `v5.x` version alias:

- `stable`: Installs the recommended stable version (`v5` version as of january 2025).
- `legacy`: Installs the latest `v5` version (and will stay on this version).

```sh
# install stable (recommended approach)

sf plugins install sfdx-git-delta@stable
```

```sh
# install a specific version (5.46.0 for example)

sf plugins install sfdx-git-delta@v5.46.0
```

```sh
# install legacy

sf plugins install sfdx-git-delta@legacy
```

## Details

### <a name="deprecated-parameters"></a> Deprecated Parameters

Several "long" parameters have been deprecated and replaced by new ones to comply with [sf design guidelines](https://github.com/salesforcecli/cli/wiki/Design-Guidelines-Flags):

- `--ignore` → `--ignore-file` (short `-i`)
- `--ignore-destructive` → `--ignore-destructive-file` (short `-D`)
- `--include` → `--include-file` (short `-n`)
- `--include-destructive` → `--include-destructive-file` (short `-N`)
- `--output` → `--output-dir` (short `-o`)
- `--repo` → `--repo-dir` (short `-r`)
- `--source` → `--source-dir` (short `-s`)

For now, the old parameters are still functional, but they will stop working in a future release. It is recommended to migrate to the new parameters as soon as possible.

### <a name="param-error"></a> Error Handling for File and Directory Parameters

Error handling for [file](https://github.com/salesforcecli/cli/wiki/Code-Your-Plugin#file) and [directory](https://github.com/salesforcecli/cli/wiki/Code-Your-Plugin#directory) type parameters is now managed by the Salesforce CLI itself. The following parameters are affected by this change:

- `--ignore-file`
- `--ignore-destructive-file`
- `--include-file`
- `--include-destructive-file`
- `--output-dir`
- `--repo-dir`
- `--source-dir`

Errors are now surfaced by the Salesforce CLI, which impacts both the [standard output](#default-output) and [JSON output](#json-output).

### <a name="drop-old-cli"></a> sfdx/cli No Longer Supported

With the migration to the [sf plugin v2 architecture](https://github.com/salesforcecli/cli/wiki/Quick-Introduction-to-Developing-sf-Plugins), **sfdx-git-delta v6+** is no longer compatible with the [deprecated `sfdx/cli`](https://github.com/salesforcecli/sfdx-cli/). It now requires [`@salesforce/cli`](https://github.com/salesforcecli/cli).

If you are still using `sfdx/cli`, please [migrate to sf (v2)](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_move_to_sf_v2.htm) before upgrading to version 6.

### <a name="default-output"></a> Plugin Default Output

The default output format no longer displays JSON by default. Instead, it takes advantage of the new Salesforce CLI UX tools, such as spinners, to provide real-time feedback on plugin operations. Warnings and errors are also presented directly in the standard output.

To continue using JSON output, you must now pass the [`--json` flag](#json-output).

### <a name="json-output"></a> JSON Output Structure

The JSON output has been simplified by removing duplicated information and aligning it with the Salesforce CLI's built-in capabilities. Previously, the JSON output was encapsulated and included redundant information, such as:

**Old JSON Structure**

```json
{
  "status": 0,
  "result": { 
    "success": true,
    "output-dir": "<same as input parameter>",
    "error": "<encountered errors>",
    "warnings": ["<warnings>"]
  },
  "warnings": [
  ]
}
```

**New JSON Structure**
```json
{
  "status": 0,
  "result": {
    "output-dir": "<same as input parameter or default value>",
    "error": "<plugin encountered error>"
  },
  "warnings": ["<encountered warnings>"]
}
```

When errors arise due to file/directory issues or other sf CLI-level problems, the output will look like this:
```json
{
  "name": "Error",
  "message": "<sf cli encountered error>",
  "exitCode": 1,
  "context": "SourceDeltaGenerate",
  "stack": "<stack>",
  "cause": "<cause>",
  "warnings": [],
  "code": "1",
  "status": 1,
  "commandName": "SourceDeltaGenerate"
}
```

### <a name="export-module"></a> Export esm instead of commonjs

The plugin now exports using ES modules (with no more CommonJS support and no `esmInteroperability`).
Here’s is how to import the plugin:

```js
import sgd from 'sfdx-git-delta'
```

### <a name="api-version-format"></a> API version format

Previously, the plugin accepted API versions using the -a or --api-version parameter in two formats:
- Integer (e.g., `62`)
- Float (e.g., `62.0`)

Now it uses the [`orgApiVersionFlag`](https://github.com/salesforcecli/sf-plugins-core/blob/43c7203a55ed2fa063d2bff3b62dfd16b37410ce/src/flags/orgApiVersion.ts#L39) standard flag and only accept floats ending with `.0` (e.g., `62.0`)
Providing an integer will result in an error:  
_"62 is not a valid API version. It should end in '.0' like '54.0'."_

### <a name="setting-log-level"></a> Setting LogLevel

Previously with `sfdx/cli` LogLevel was set using the `--loglevel` parameter. It is deprecated, you cannot set the loglevel this way anymore.
Now with the `salesforce/cli` LogLevel is set with the [SF_LOG_LEVEL environment variable](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_dev_cli_log_messages.htm)
