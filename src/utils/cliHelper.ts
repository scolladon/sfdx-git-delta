import { Config } from '../model/Config'
import RepoSetup from './repoSetup'
import { sanitizePath } from './childProcessUtils'
import { existsSync, statSync } from 'fs'
export default class CLIHelper {
  config: Config
  repoSetup: RepoSetup

  constructor(config: Config) {
    this.config = config
    this.repoSetup = new RepoSetup(config)
  }

  validateConfig(): void {
    this._sanitizeConfig()
    const errors: Array<string> = []
    if (typeof this.config.to !== 'string') {
      errors.push(`to ${this.config.to} is not a sha`)
    }
    if (isNaN(this.config.apiVersion)) {
      errors.push(`api-version ${this.config.apiVersion} is not a number`)
    }
    ;[this.config.output, this.config.source]
      .filter(dir => !CLIHelper._dirExist(dir))
      .forEach(dir => errors.push(`${dir} folder does not exist`))

    if (!CLIHelper._isGit(this.config.repo)) {
      errors.push(`${this.config.repo} is not a git repository`)
    }

    if (!this.repoSetup.isToEqualHead() && this.config.generateDelta) {
      errors.push(
        `--generate-delta (-d) parameter cannot be used when --to (-t) parameter is not equivalent to HEAD`
      )
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '))
    }

    this.repoSetup.repoConfiguration()
  }

  _sanitizeConfig(): void {
    //this.config.apiVersion = parseInt(this.config.apiVersion)
    this.config.repo = sanitizePath(this.config.repo)
    this.config.source = sanitizePath(this.config.source)
    this.config.output = sanitizePath(this.config.output)
    this.config.ignore = sanitizePath(this.config.ignore)
    this.config.ignoreDestructive = sanitizePath(this.config.ignoreDestructive)
    this.config.from = this.repoSetup.computeFromRef()
  }

  static _dirExist(dir: string): boolean {
    return existsSync(dir) && statSync(dir).isDirectory()
  }

  static _isGit(dir: string): boolean {
    return existsSync(path.join(dir, '.git'))
  }

  static IGNORE_DEFAULT_VALUE: string = '.'
  static OUTPUT_DEFAULT_VALUE: string = './output'
  static REPO_DEFAULT_VALUE: string = '.'
  static SOURCE_DEFAULT_VALUE: string = '.'
  static TO_DEFAULT_VALUE: string = 'HEAD'
}
