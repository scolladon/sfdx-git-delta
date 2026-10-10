'use strict'
import type { MetadataRepository } from '../metadata/MetadataRepository.js'

// Locale-invariant on purpose: a locale-sensitive fold makes the
// cancellation key depend on the machine that ran the diff.
export const comparisonName = (
  metadata: MetadataRepository,
  line: string
): string => metadata.getFullyQualifiedName(line).toLowerCase()
