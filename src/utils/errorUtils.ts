'use strict'

/**
 * Extracts a message from an unknown error value.
 * Safe to call with any caught value.
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

/**
 * Creates a new Error with the original error as cause for stack trace preservation.
 * Use this when wrapping errors to maintain the full error chain.
 */
export const wrapError = (message: string, cause: unknown): Error => {
  return new Error(message, { cause })
}

/**
 * Type guard to check if a value is an Error instance.
 * Useful for narrowing types in catch blocks.
 */
export const isError = (value: unknown): value is Error => {
  return value instanceof Error
}
