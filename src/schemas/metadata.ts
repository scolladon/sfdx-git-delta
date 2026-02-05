'use strict'
import { z } from 'zod'

// ============================================================
// Zod Schemas - Single source of truth for metadata types
// ============================================================

/**
 * Base metadata schema with optional suffix and xmlName
 */
export const BaseMetadataSchema = z.object({
  suffix: z.string().optional(),
  xmlName: z.string().optional(),
})

/**
 * Shared folder metadata extends base with optional content array
 */
export const SharedFolderMetadataSchema = BaseMetadataSchema.extend({
  content: z.array(BaseMetadataSchema).optional(),
})

/**
 * Shared file metadata extends base with parent/child relationship fields
 */
export const SharedFileMetadataSchema = BaseMetadataSchema.extend({
  parentXmlName: z.string().optional(),
  xmlTag: z.string().optional(),
  key: z.string().optional(),
  excluded: z.boolean().optional(),
  pruneOnly: z.boolean().optional(),
})

/**
 * Complete metadata schema combining all metadata aspects
 */
export const MetadataSchema = BaseMetadataSchema.merge(
  SharedFolderMetadataSchema
)
  .merge(SharedFileMetadataSchema)
  .extend({
    directoryName: z.string(),
    inFolder: z.boolean(),
    metaFile: z.boolean(),
    childXmlNames: z.array(z.string()).optional(),
  })

/**
 * Strict metadata schema for validating external input (additional registry)
 * Requires xmlName to be non-empty
 */
export const StrictMetadataSchema = MetadataSchema.extend({
  xmlName: z.string().min(1, 'xmlName is required and cannot be empty'),
}).strict()

/**
 * Array schema for validating metadata arrays
 */
export const MetadataArraySchema = z.array(StrictMetadataSchema)

// ============================================================
// Inferred Types - Derived from schemas, no duplication
// ============================================================

export type BaseMetadata = z.infer<typeof BaseMetadataSchema>
export type SharedFolderMetadata = z.infer<typeof SharedFolderMetadataSchema>
export type SharedFileMetadata = z.infer<typeof SharedFileMetadataSchema>
export type Metadata = z.infer<typeof MetadataSchema>
