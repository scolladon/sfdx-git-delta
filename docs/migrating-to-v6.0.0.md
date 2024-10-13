# Migrating to `v6.0.0`

Version `V6.0.0` migrate the plugin to sf plugin v2.
It comes with a lot of maintained feature opening the plugin to easier maintainability and better security.
And also with a few new behavior and breaking changes.

## New behavior

* [Deprecated parameters](deprecated-parameters)
* [Error handling for file and dir parameters](param-error)

## Breaking changes

* [Node js below 20 are no longer supported](drop-old-node)
* [sfdx/cli no longer supported](drop-old-cli)
* [Plugin default output](default-output)
* [JSON output structure](json-output)
* [Export esm instead of commonjs](export-module)

## Details

### <a name="deprecated-parameters"></a> Deprecated parameters

The following "long" parameters have been deprecated and are replaced by new parameters to follow [design guidelines](https://github.com/salesforcecli/cli/wiki/Design-Guidelines-Flags):
- `--ignore` is deprecated and replaced by `--ignore-file` (short `-i` is mapped with this parameter)
- `--ignore-destructive` is deprecated and replaced by `--ignore-destructive-file` (short `-D` is mapped with this parameter)
- `--include` is deprecated and replaced by `--include-file` (short `-n` is mapped with this parameter)
- `--include-destructive` is deprecated and replaced by `--include-destructive-file` (short `-N` is mapped with this parameter)
- `--output` is deprecated and replaced by `--output-dir` (short `-o` is mapped with this parameter)
- `--repo` is deprecated and replaced by `--repo-dir` (short `-r` is mapped with this parameter)
- `--source` is deprecated and replaced by `--source-dir` (short `-s` is mapped with this parameter)

It is still possible to use them but they will soon be obsolet and will no longer be usable.

### <a name="param-error"></a> Error handling for file and dir parameters

Error handling for [file](https://github.com/salesforcecli/cli/wiki/Code-Your-Plugin#file) and [directory](https://github.com/salesforcecli/cli/wiki/Code-Your-Plugin#directory) type parameters are now handled by the cli flags itself.
The following parameters are concerned by this change : 
- `--ignore-file`
- `--ignore-destructive-file`
- `--include-file`
- `--include-destructive-file`
- `--output-dir`
- `--repo-dir`
- `--source-dir`

Errors are now returned by the cli itself, it changes the (standard output)[default-output] and the (json output)[json-output].

### <a name="drop-old-node"></a> Node js below 20 are no longer supported

The plugin no longer support node version below 20.
There are no checks in the CI to test if the plugin works outside node 20 and node 22.
This is to be compliant with the [salesforce/cli guidelines](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm#sfdx_setup_install_cli_npm:~:text=long%2Dterm%20support%20(-,Active%20LTS,-)%20version%20of%20Node) with node js version.

### <a name="drop-old-cli"></a> sfdx/cli no longer supported

Migrating to [sf plugin v2 architecture](https://github.com/salesforcecli/cli/wiki/Quick-Introduction-to-Developing-sf-Plugins?ref=pablogonzalez.io) does not allow sfdx-git-delta to still be compatible with the [deprecated `sfdx/cli`](https://github.com/salesforcecli/sfdx-cli/).
sfdx-git-delta `v6+` is only compatible with [`@salesforce/cli`](https://github.com/salesforcecli/cli).

### <a name="default-output"></a> Plugin default output

Default output no longer display JSON information.
It uses the new sf cli UX tools and display a sfdx cli spinner to provide information about what the plugin is doing.
It also display warning and errors directly in the standard output.

If you were using the json output of the plugin, you need to pass the (`--json` parameter)[json-output].

### <a name="json-output"></a> JSON output structure

JSON output has changed to remove duplicated information from the cli JSON output and reuse built in sf cli capacity
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

Here is the new version of the JSON structure :
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

When there are error at the cli itself (file or directory parameter does not exist), the result looks like:
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

The plugin ship js as a module using `export default`.
It compile using `"esModuleInterop"=false` tsconfig.
Here is how to import it now :

```js
import sgd from 'sfdx-git-delta'
```