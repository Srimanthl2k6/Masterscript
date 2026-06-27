import type { ScriptProject } from '../types/screenplay'
import { validateProjectCandidate } from './adapters/importLimits'
import { reconcileSceneNumberLabels } from './sceneNumbering'
import { createBlock, createEmptyProject } from './screenplay'

export const hydrateProject = (candidate: ScriptProject): ScriptProject => {
  validateProjectCandidate(candidate)
  const fallback = createEmptyProject()
  const legacySceneNumbering = candidate.advanced?.sceneNumbering as
    | (typeof fallback.advanced.sceneNumbering & { manualMode?: unknown })
    | undefined
  const candidateSceneNumbering = { ...(legacySceneNumbering ?? {}) }
  delete candidateSceneNumbering.manualMode
  const hydrated = {
    ...fallback,
    ...candidate,
    schemaVersion: 1,
    meta: {
      ...fallback.meta,
      ...candidate.meta,
    },
    blocks:
      candidate.blocks?.map((block) => ({
        ...createBlock('action'),
        ...block,
      })) ?? fallback.blocks,
    revisionSnapshots:
      candidate.revisionSnapshots?.map((snapshot) => ({
        ...snapshot,
        blocks:
          snapshot.blocks?.map((block) => ({
            ...createBlock('action'),
            ...block,
          })) ?? [],
      })) ?? fallback.revisionSnapshots,
    revisionDraftSets:
      candidate.revisionDraftSets ?? fallback.revisionDraftSets,
    dialogueStash: candidate.dialogueStash ?? fallback.dialogueStash,
    cards: candidate.cards ?? [],
    production: {
      schedule: candidate.production?.schedule ?? [],
      breakdown: candidate.production?.breakdown ?? [],
      shots: candidate.production?.shots ?? [],
      crew: candidate.production?.crew ?? [],
    },
    budget: {
      items: candidate.budget?.items ?? [],
    },
    storyboards: candidate.storyboards ?? [],
    catalog: candidate.catalog ?? [],
    story: candidate.story ?? fallback.story,
    characters: candidate.characters ?? fallback.characters,
    productivity: candidate.productivity ?? fallback.productivity,
    tagging: candidate.tagging ?? fallback.tagging,
    advanced: {
      ...fallback.advanced,
      ...candidate.advanced,
      formatting: {
        ...fallback.advanced.formatting,
        ...candidate.advanced?.formatting,
      },
      sceneNumbering: {
        ...fallback.advanced.sceneNumbering,
        ...candidateSceneNumbering,
      },
      titlePage: {
        ...fallback.advanced.titlePage,
        ...candidate.advanced?.titlePage,
      },
      timing: {
        ...fallback.advanced.timing,
        ...candidate.advanced?.timing,
        weights: {
          ...fallback.advanced.timing.weights,
          ...candidate.advanced?.timing?.weights,
        },
      },
      lint: {
        ...fallback.advanced.lint,
        ...candidate.advanced?.lint,
      },
      series: {
        ...fallback.advanced.series,
        ...candidate.advanced?.series,
      },
      writerRoom: {
        ...fallback.advanced.writerRoom,
        ...candidate.advanced?.writerRoom,
      },
      print: {
        ...fallback.advanced.print,
        ...candidate.advanced?.print,
      },
      accessibility: {
        ...fallback.advanced.accessibility,
        ...candidate.advanced?.accessibility,
      },
      editor: {
        ...fallback.advanced.editor,
        ...candidate.advanced?.editor,
        shortcuts: {
          ...fallback.advanced.editor.shortcuts,
          ...candidate.advanced?.editor?.shortcuts,
        },
      },
      legal: {
        ...fallback.advanced.legal,
        ...candidate.advanced?.legal,
      },
    },
  }
  return reconcileSceneNumberLabels(hydrated)
}
