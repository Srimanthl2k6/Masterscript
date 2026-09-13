import * as Y from 'yjs'
import type { ScriptBlock, ScriptProject, ScriptProjectMeta } from '../../types/screenplay'

export const LOCAL_ORIGIN = Symbol('masterscript-local')

type ProjectMap = Y.Map<unknown>
type BlockMap = Y.Map<unknown>

const topLevelJsonKeys = [
  'revisionSnapshots',
  'revisionDraftSets',
  'dialogueStash',
  'cards',
  'production',
  'budget',
  'storyboards',
  'catalog',
  'story',
  'characters',
  'productivity',
  'tagging',
  'advanced',
] as const satisfies ReadonlyArray<keyof ScriptProject>

const blockScalarKeys = [
  'id',
  'type',
  'revision',
  'extension',
  'dualDialogueId',
  'dualDialogueSide',
  'revisionMark',
  'locked',
  'omitted',
  'omittedText',
  'lockedPageLabel',
  'formatRanges',
] as const satisfies ReadonlyArray<keyof ScriptBlock>

const cloneJson = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

const replaceMapEntries = (
  target: Y.Map<unknown>,
  entries: Record<string, unknown>,
) => {
  for (const key of Array.from(target.keys())) {
    if (!(key in entries)) {
      target.delete(key)
    }
  }

  for (const [key, value] of Object.entries(entries)) {
    target.set(key, cloneJson(value))
  }
}

const createMetaMap = (meta: ScriptProjectMeta): Y.Map<unknown> => {
  const metaMap = new Y.Map<unknown>()
  replaceMapEntries(metaMap, meta as unknown as Record<string, unknown>)
  return metaMap
}

export const applyTextDiff = (text: Y.Text, nextValue: string) => {
  const currentValue = text.toString()
  if (currentValue === nextValue) {
    return
  }

  let prefixLength = 0
  const maxPrefixLength = Math.min(currentValue.length, nextValue.length)
  while (
    prefixLength < maxPrefixLength &&
    currentValue[prefixLength] === nextValue[prefixLength]
  ) {
    prefixLength += 1
  }

  let suffixLength = 0
  const maxSuffixLength = maxPrefixLength - prefixLength
  while (
    suffixLength < maxSuffixLength &&
    currentValue[currentValue.length - 1 - suffixLength] ===
      nextValue[nextValue.length - 1 - suffixLength]
  ) {
    suffixLength += 1
  }

  const deleteLength = currentValue.length - prefixLength - suffixLength
  if (deleteLength > 0) {
    text.delete(prefixLength, deleteLength)
  }

  const inserted = nextValue.slice(prefixLength, nextValue.length - suffixLength)
  if (inserted) {
    text.insert(prefixLength, inserted)
  }
}

const getBlockText = (blockMap: BlockMap): Y.Text => {
  const current = blockMap.get('text')
  if (current instanceof Y.Text) {
    return current
  }

  const text = new Y.Text()
  if (typeof current === 'string') {
    text.insert(0, current)
  }
  blockMap.set('text', text)
  return text
}

const createBlockMap = (block: ScriptBlock): BlockMap => {
  const blockMap = new Y.Map<unknown>()
  for (const key of blockScalarKeys) {
    blockMap.set(key, cloneJson(block[key]))
  }

  const text = new Y.Text()
  text.insert(0, block.text)
  blockMap.set('text', text)
  return blockMap
}

const updateBlockMap = (blockMap: BlockMap, block: ScriptBlock) => {
  for (const key of blockScalarKeys) {
    blockMap.set(key, cloneJson(block[key]))
  }

  applyTextDiff(getBlockText(blockMap), block.text)
}

const syncBlocks = (blocksArray: Y.Array<BlockMap>, blocks: ScriptBlock[]) => {
  const currentMaps = blocksArray.toArray()
  const canUpdateInPlace =
    currentMaps.length === blocks.length &&
    currentMaps.every((blockMap, index) => blockMap.get('id') === blocks[index].id)

  if (canUpdateInPlace) {
    blocks.forEach((block, index) => updateBlockMap(currentMaps[index], block))
    return
  }

  const wanted = new Set(blocks.map(block => block.id))
  for (let index = blocksArray.length - 1; index >= 0; index -= 1) {
    if (!wanted.has(String(blocksArray.get(index).get('id')))) blocksArray.delete(index, 1)
  }
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]
    const current = index < blocksArray.length ? blocksArray.get(index) : null
    if (current?.get('id') === block.id) {
      updateBlockMap(current, block)
    } else {
      // Preserve unaffected Y.Text objects so concurrent edits remain anchored
      // when Enter inserts a block. Only a genuine reorder recreates a moved map.
      const movedIndex = blocksArray.toArray().findIndex(map => map.get('id') === block.id)
      if (movedIndex >= 0) blocksArray.delete(movedIndex, 1)
      blocksArray.insert(index, [createBlockMap(block)])
    }
  }
}

export const getProjectMap = (ydoc: Y.Doc): ProjectMap => ydoc.getMap('project')

export const getBlocksArray = (ydoc: Y.Doc): Y.Array<BlockMap> => {
  const projectMap = getProjectMap(ydoc)
  const current = projectMap.get('blocks')
  if (current instanceof Y.Array) {
    return current as Y.Array<BlockMap>
  }

  const blocksArray = new Y.Array<BlockMap>()
  projectMap.set('blocks', blocksArray)
  return blocksArray
}

export const findBlockMap = (ydoc: Y.Doc, blockId: string): BlockMap | null => {
  for (const blockMap of getBlocksArray(ydoc).toArray()) {
    if (blockMap.get('id') === blockId) {
      return blockMap
    }
  }

  return null
}

export const hasRenderableProject = (ydoc: Y.Doc): boolean => {
  const projectMap = getProjectMap(ydoc)
  return (
    typeof projectMap.get('id') === 'string' &&
    projectMap.get('meta') instanceof Y.Map &&
    projectMap.get('blocks') instanceof Y.Array
  )
}

export const scriptProjectToYDoc = (project: ScriptProject): Y.Doc => {
  const ydoc = new Y.Doc()
  applyProjectToYDoc(ydoc, project)
  return ydoc
}

export const applyProjectToYDoc = (
  ydoc: Y.Doc,
  project: ScriptProject,
  origin: unknown = LOCAL_ORIGIN,
) => {
  ydoc.transact(() => {
    const projectMap = getProjectMap(ydoc)
    projectMap.set('id', project.id)
    projectMap.set('schemaVersion', project.schemaVersion)

    const currentMeta = projectMap.get('meta')
    if (currentMeta instanceof Y.Map) {
      replaceMapEntries(currentMeta, project.meta as unknown as Record<string, unknown>)
    } else {
      projectMap.set('meta', createMetaMap(project.meta))
    }

    syncBlocks(getBlocksArray(ydoc), project.blocks)

    for (const key of topLevelJsonKeys) {
      projectMap.set(key, cloneJson(project[key]))
    }
  }, origin)
}

const readMeta = (projectMap: ProjectMap): ScriptProjectMeta => {
  const meta = projectMap.get('meta')
  if (meta instanceof Y.Map) {
    return Object.fromEntries(meta.entries()) as unknown as ScriptProjectMeta
  }

  return cloneJson(meta) as ScriptProjectMeta
}

const readBlock = (blockMap: BlockMap): ScriptBlock => {
  const text = blockMap.get('text')
  const result: Partial<ScriptBlock> = {}
  for (const key of blockScalarKeys) {
    result[key] = cloneJson(blockMap.get(key)) as never
  }

  return {
    ...(result as ScriptBlock),
    text: text instanceof Y.Text ? text.toString() : String(text ?? ''),
  }
}

export const yDocToScriptProject = (ydoc: Y.Doc): ScriptProject => {
  const projectMap = getProjectMap(ydoc)
  const project = {
    id: String(projectMap.get('id') ?? ''),
    schemaVersion: Number(projectMap.get('schemaVersion') ?? 1),
    meta: readMeta(projectMap),
    blocks: getBlocksArray(ydoc).toArray().map(readBlock),
  } as ScriptProject

  for (const key of topLevelJsonKeys) {
    project[key] = cloneJson(projectMap.get(key)) as never
  }

  return project
}
