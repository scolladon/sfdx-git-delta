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

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

export const wrapError = (message: string, cause: unknown): SgdError => {
  return new SgdError(message, { cause })
}
