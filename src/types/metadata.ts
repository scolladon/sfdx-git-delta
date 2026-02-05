'use strict'

// Re-export types from schemas (single source of truth)
// This file is kept for backward compatibility with existing imports
export type {
  Metadata,
  SharedFileMetadata,
  SharedFolderMetadata,
} from '../schemas/metadata.js'
