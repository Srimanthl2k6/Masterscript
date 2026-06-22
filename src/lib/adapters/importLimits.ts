import type { ScriptProjectAdapterResult } from './types'
import type { ScriptProject } from '../../types/screenplay'
import { blockTypeOrder } from '../../types/screenplay'

export const MAX_TEXT_IMPORT_BYTES = 10 * 1024 * 1024
export const MAX_DOCX_COMPRESSED_BYTES = 25 * 1024 * 1024
export const MAX_GENERATED_TEXT_BYTES = 20 * 1024 * 1024
export const MAX_IMPORTED_BLOCKS = 50_000
export const MAX_PROJECT_JSON_BYTES = 50 * 1024 * 1024
export const MAX_PROJECT_JSON_NODES = 500_000
const supportedBlockTypes = new Set<string>(blockTypeOrder)

const utf8Length = (value: string): number =>
  new TextEncoder().encode(value).byteLength

export const validateTextImportSize = (content: string): void => {
  if (utf8Length(content) > MAX_TEXT_IMPORT_BYTES) {
    throw new Error('Text import exceeds the 10 MiB limit.')
  }
}

export const validateDocxImportSize = (content: ArrayBuffer): void => {
  if (content.byteLength > MAX_DOCX_COMPRESSED_BYTES) {
    throw new Error('DOCX compressed size exceeds the 25 MiB limit.')
  }
}

export const validateImportedProjectResult = (
  result: ScriptProjectAdapterResult,
): ScriptProjectAdapterResult => {
  validateProjectCandidate(result.data)
  if (result.data.blocks.length > MAX_IMPORTED_BLOCKS) {
    throw new Error('Imported screenplay exceeds the 50,000 blocks limit.')
  }
  return result
}

export const validateProjectCandidate = (candidate: unknown): ScriptProject => {
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    (candidate as { schemaVersion?: unknown }).schemaVersion !== 1 ||
    typeof (candidate as { id?: unknown }).id !== 'string' ||
    !(candidate as { meta?: unknown }).meta ||
    typeof (candidate as { meta?: unknown }).meta !== 'object' ||
    !Array.isArray((candidate as { blocks?: unknown }).blocks)
  ) {
    throw new Error('Project JSON is missing required project fields.')
  }

  const project = candidate as ScriptProject
  const validateBlocks = (
    blocks: unknown[],
    label: string,
  ): void => {
    for (const block of blocks) {
      if (
        !block ||
        typeof block !== 'object' ||
        typeof (block as { id?: unknown }).id !== 'string' ||
        typeof (block as { type?: unknown }).type !== 'string' ||
        !supportedBlockTypes.has((block as { type: string }).type) ||
        typeof (block as { text?: unknown }).text !== 'string'
      ) {
        throw new Error(`${label} contains invalid block fields.`)
      }
    }
  }
  if (project.blocks.length > MAX_IMPORTED_BLOCKS) {
    throw new Error('Project JSON exceeds the 50,000 blocks limit.')
  }
  validateBlocks(project.blocks, 'Project JSON')
  if (
    project.revisionSnapshots !== undefined &&
    (!Array.isArray(project.revisionSnapshots) ||
      project.revisionSnapshots.length > 60 ||
      project.revisionSnapshots.some(
        (snapshot) =>
          !Array.isArray(snapshot?.blocks) ||
          snapshot.blocks.length > MAX_IMPORTED_BLOCKS,
      ))
  ) {
    throw new Error('Project JSON contains invalid or oversized revision snapshots.')
  }
  for (const snapshot of project.revisionSnapshots ?? []) {
    validateBlocks(snapshot.blocks, 'Project JSON revision snapshot')
  }

  let textBytes = 0
  let nodes = 0
  const visit = (value: unknown, depth: number): void => {
    nodes += 1
    if (nodes > MAX_PROJECT_JSON_NODES) {
      throw new Error('Project JSON contains too many values.')
    }
    if (depth > 32) {
      throw new Error('Project JSON nesting exceeds the supported depth.')
    }
    if (typeof value === 'string') {
      textBytes += utf8Length(value)
      if (textBytes > MAX_GENERATED_TEXT_BYTES) {
        throw new Error('Project JSON text exceeds the 20 MiB limit.')
      }
      return
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        visit(entry, depth + 1)
      }
      return
    }
    if (value && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value)) {
        textBytes += utf8Length(key)
        if (textBytes > MAX_GENERATED_TEXT_BYTES) {
          throw new Error('Project JSON text exceeds the 20 MiB limit.')
        }
        visit(entry, depth + 1)
      }
    }
  }
  visit(project, 0)
  return project
}
