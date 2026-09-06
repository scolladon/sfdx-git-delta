'use strict'

export class SgdError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SgdError'
  }
}

export class ConfigError extends SgdError {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

export class MetadataRegistryError extends SgdError {
  constructor(message: string) {
    super(message)
    this.name = 'MetadataRegistryError'
  }
}

export class RepositoryRefusalError extends SgdError {
  constructor(message: string) {
    super(message)
    this.name = 'RepositoryRefusalError'
  }
}

// The kinds a revision can peel to without being a commit: the tag chain is
// always followed first, so a tag never reaches this error, and a commit is
// the success path — which leaves exactly these two.
export type NonCommitObjectType = 'tree' | 'blob'

export class NotACommitError extends SgdError {
  constructor(
    label: string,
    readonly objectType: NonCommitObjectType
  ) {
    super(`'${label}' does not resolve to a commit (it is a ${objectType})`)
    this.name = 'NotACommitError'
  }
}

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

export const wrapError = (message: string, cause: unknown): SgdError => {
  return new SgdError(message, { cause })
}
