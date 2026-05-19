import type {
  SceneDevelopmentMeta,
  SceneStatus,
  ScriptBlock,
  ScriptProject,
  StoryDevelopmentState,
  StoryNotes,
  StoryOutlineNode,
} from '../types/screenplay'
import { cloneProject, extractScenes } from './screenplay'

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

const defaultNotes = (): StoryNotes => ({
  script: '',
  scratchpad: '',
  scenes: {},
  inline: [],
})

export const defaultSceneDevelopmentMeta = (
  sceneId: string,
): SceneDevelopmentMeta => ({
  sceneId,
  status: 'Draft',
  color: '#2f2f2f',
  summary: '',
  actBreak: '',
})

export const ensureStoryDevelopmentState = (
  project: ScriptProject,
): ScriptProject => {
  const next = cloneProject(project)
  const fallback: StoryDevelopmentState = {
    outline: [],
    sceneMeta: {},
    notes: defaultNotes(),
  }

  next.story = {
    ...fallback,
    ...next.story,
    notes: {
      ...fallback.notes,
      ...next.story?.notes,
      scenes: next.story?.notes?.scenes ?? {},
      inline: next.story?.notes?.inline ?? [],
    },
    sceneMeta: next.story?.sceneMeta ?? {},
    outline: next.story?.outline ?? [],
  }

  for (const scene of extractScenes(next)) {
    if (!next.story.sceneMeta[scene.blockId]) {
      next.story.sceneMeta[scene.blockId] = defaultSceneDevelopmentMeta(scene.blockId)
    }
  }

  return next
}

export const buildHierarchicalOutline = (
  project: ScriptProject,
): StoryOutlineNode[] => {
  const scenes = extractScenes(project)

  return [
    {
      id: 'act-1',
      type: 'act',
      title: 'Act 1',
      sceneId: null,
      children: [
        {
          id: 'sequence-1',
          type: 'sequence',
          title: 'Sequence 1',
          sceneId: null,
          children: scenes.map((scene, index) => ({
            id: `scene-node-${scene.blockId}`,
            type: 'scene',
            title: scene.heading,
            sceneId: scene.blockId,
            children: [],
            index,
          })) as StoryOutlineNode[],
        },
      ],
    },
  ]
}

const splitIntoSceneChunks = (blocks: ScriptBlock[]) => {
  const prelude: ScriptBlock[] = []
  const chunks: Array<{ sceneId: string; blocks: ScriptBlock[] }> = []
  let activeChunk: { sceneId: string; blocks: ScriptBlock[] } | null = null

  for (const block of blocks) {
    if (block.type === 'scene-heading') {
      activeChunk = { sceneId: block.id, blocks: [block] }
      chunks.push(activeChunk)
      continue
    }

    if (activeChunk) {
      activeChunk.blocks.push(block)
    } else {
      prelude.push(block)
    }
  }

  return { prelude, chunks }
}

export const reorderScenesByOutline = (
  project: ScriptProject,
  sceneOrder: string[],
): ScriptProject => {
  const next = cloneProject(project)
  const { prelude, chunks } = splitIntoSceneChunks(next.blocks)
  const chunkBySceneId = new Map(chunks.map((chunk) => [chunk.sceneId, chunk]))
  const ordered: ScriptBlock[] = [...prelude]
  const used = new Set<string>()

  for (const sceneId of sceneOrder) {
    const chunk = chunkBySceneId.get(sceneId)
    if (chunk) {
      ordered.push(...chunk.blocks)
      used.add(sceneId)
    }
  }

  for (const chunk of chunks) {
    if (!used.has(chunk.sceneId)) {
      ordered.push(...chunk.blocks)
    }
  }

  next.blocks = ordered
  next.story.outline = buildHierarchicalOutline(next)
  return next
}

export const updateCorkboardCard = (
  project: ScriptProject,
  cardId: string,
  updates: { x?: number; y?: number; color?: string; imageDataUrl?: string },
): ScriptProject => {
  const next = ensureStoryDevelopmentState(project)
  const target = next.cards.find((card) => card.id === cardId)

  if (target) {
    Object.assign(target, updates)
  }

  return next
}

export const setSceneDevelopmentMeta = (
  project: ScriptProject,
  sceneId: string,
  updates: Partial<Omit<SceneDevelopmentMeta, 'sceneId'>> & {
    status?: SceneStatus
  },
): ScriptProject => {
  const next = ensureStoryDevelopmentState(project)
  next.story.sceneMeta[sceneId] = {
    ...defaultSceneDevelopmentMeta(sceneId),
    ...next.story.sceneMeta[sceneId],
    ...updates,
    sceneId,
  }
  return next
}

export const setSceneNote = (
  project: ScriptProject,
  kind: 'script' | 'scratchpad' | 'scene' | 'inline',
  text: string,
  sceneId: string | null = null,
  blockId: string | null = null,
): ScriptProject => {
  const next = ensureStoryDevelopmentState(project)

  if (kind === 'script') {
    next.story.notes.script = text
    return next
  }

  if (kind === 'scratchpad') {
    next.story.notes.scratchpad = text
    return next
  }

  if (kind === 'scene' && sceneId) {
    next.story.notes.scenes[sceneId] = text
    return next
  }

  if (kind === 'inline') {
    next.story.notes.inline.push({
      id: createId(),
      sceneId,
      blockId,
      text,
      createdAt: new Date().toISOString(),
    })
  }

  return next
}
