# Migrating to `v6.0.0`

Version `v6.0.0` migrates the plugin to sf plugin v2.
While it improves maintainability and security, it also introduces some new behaviors and potentially breaking changes.
Versions `v5.x` and below **will not be maintained** anymore (_no bug fixes, no new metadata support, no new API version, no new features_). 

## New behaviors

* [Deprecated parameters](#deprecated-parameters)
* [Error handling for file and dir parameters](#param-error)

## Breaking changes

* [sfdx/cli no longer supported](#drop-old-cli)
* [Plugin default output](#default-output)
* [JSON output structure](#json-output)
* [Export esm instead of commonjs](#export-module)

## Installation Details

`sfdx-git-delta` `+v6.x` will follow the actual channel release pattern : 
- channel `latest-rc` contains the **latest fixes and feature** validated by our test battery as a release candidate.
- channel `latest` contains a **customer validated** by real customers.
- channel `stable` contains the **last version without bugs** for +50k(ish) downloads.

> [!NOTE]
> If you were installing the plugin this way **and** you are not impacted by the `v6` changes, then it will be totally transparent for you.

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

### legacy version installation

In case you need more time, old plugin version will still be installable via either the version number directly or via legacy channels:
- channel `legacy-latest` will match with the **latest v5** version.
- channel `legacy-stable` will match with the **latest stable v5** version (`v5.34.0`).

```sh
# install a specific version (5.46.0 for example)

sf plugins install sfdx-git-delta@v5.46.0

# install legacy-latest

sf plugins install sfdx-git-delta@legacy-latest

# install legacy-stable

sf plugins install sfdx-git-delta@legacy-stable
```

## Details

### <a name="deprecated-parameters"></a> Deprecated parameters

The following "long" parameters have been deprecated and are replaced by new parameters to follow [sf design guidelines](https://github.com/salesforcecli/cli/wiki/Design-Guidelines-Flags):
- `--ignore` is deprecated and replaced by `--ignore-file` (short `-i` is mapped with this parameter)
- `--ignore-destructive` is deprecated and replaced by `--ignore-destructive-file` (short `-D` is mapped with this parameter)
- `--include` is deprecated and replaced by `--include-file` (short `-n` is mapped with this parameter)
- `--include-destructive` is deprecated and replaced by `--include-destructive-file` (short `-N` is mapped with this parameter)
- `--output` is deprecated and replaced by `--output-dir` (short `-o` is mapped with this parameter)
- `--repo` is deprecated and replaced by `--repo-dir` (short `-r` is mapped with this parameter)
- `--source` is deprecated and replaced by `--source-dir` (short `-s` is mapped with this parameter)

For now the old "long" parameters are still usable, but they will stop working in the near future. Please migrate to the new parameters.

### <a name="param-error"></a> Error handling for file and dir parameters

Error handling for [file](https://github.com/salesforcecli/cli/wiki/Code-Your-Plugin#file) and [directory](https://github.com/salesforcecli/cli/wiki/Code-Your-Plugin#directory) type parameters are now handled by the sf cli flags itself.
The following parameters are impacted by this change: 
- `--ignore-file`
- `--ignore-destructive-file`
- `--include-file`
- `--include-destructive-file`
- `--output-dir`
- `--repo-dir`
- `--source-dir`

Errors are now returned by the sf cli itself, which changes the [standard output](#default-output) and the [json output](#json-output).

### <a name="drop-old-cli"></a> sfdx/cli no longer supported

Migrating to [sf plugin v2 architecture](https://github.com/salesforcecli/cli/wiki/Quick-Introduction-to-Developing-sf-Plugins) does not allow sfdx-git-delta to still be compatible with the [deprecated `sfdx/cli`](https://github.com/salesforcecli/sfdx-cli/).
SFDX-Git-Delta `v6+` is compatible only with [`@salesforce/cli`](https://github.com/salesforcecli/cli).
If you are using sfdx, please [migrate to sf (v2)](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_move_to_sf_v2.htm) before using SGD.

### <a name="default-output"></a> Plugin default output

Default output no longer displays JSON information.
It uses the new sf cli UX tools and displays a sfdx cli spinner to provide information about what the plugin is doing.
It also displays warning and errors directly in the standard output.

To use the JSON output, you must now pass the [`--json` parameter](#json-output).

### <a name="json-output"></a> JSON output structure

JSON output has changed to remove duplicated information from the cli JSON output and reuse built in sf cli capabilities.
Previous json output was encapsulated and had duplicated information as follow:
```json
// Previous JSON output
{
  "status": 0, // duplicated with success
  "result": { 
    "success": <boolean>,
    "output-dir": "<same as input parameter or default value>",
    "error": "<encountered errors>",
    "warnings": ["<encountered warnings - duplicated with internal warnings>"]
  },
  "warnings": [
    "<was not used>"
  ]
}
```

Here is the new version of the JSON structure:
```json
// New JSON output
{
  "status": 0, // 1 in case of failure
  "result": {
    "output-dir": "<same as input parameter or default value>",
    "error": "<plugin encountered error>"
  },
  "warnings": ["<encountered warnings>"]
}
```

When there are errors at the sf cli level (file or directory parameter does not exist), the result looks like:
```json
// SF CLI error JSON output
{
  "name": "Error",
  "message": "<sf cli encountered error>", // error message
  "exitCode": 1,
  "context": "SourceDeltaGenerate",
  "stack": "<stack>",
  "cause": "<cause>",
  "warnings": [],
  "code": "1",
  "status": 1, // != 0 => error
  "commandName": "SourceDeltaGenerate"
}
```

### <a name="export-module"></a> Export esm instead of commonjs

The plugin ships js as a module using `export default`.
It compiles using `"esModuleInterop"=false` tsconfig.
Here is how to import it now:

```js
import sgd from 'sfdx-git-delta'
```