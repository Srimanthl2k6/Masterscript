import { describe, expect, it } from 'vitest'
import { paginateProjectForPrint } from './adapters/pagination'
import { createBlock, createEmptyProject } from './screenplay'
import {
  beginNextRevisionSet,
  buildAPageLabels,
  lockScene,
  omitScene,
  stashDialogueSelection,
  swapStashIntoDialogue,
  unlockScene,
  unomitScene,
  updateBlockTextWithRevisionTracking,
  wgaRevisionColorSequence,
} from './revisionProduction'

describe('revision and production mode helpers', () => {
  it('advances through the full WGA revision color sequence and stores draft sets', () => {
    let project = createEmptyProject()

    for (let index = 0; index < wgaRevisionColorSequence.length; index += 1) {
      project = beginNextRevisionSet(project, `Draft ${index + 1}`)
      expect(project.meta.activeRevision).toBe(wgaRevisionColorSequence[index])
    }

    expect(project.revisionDraftSets).toHaveLength(wgaRevisionColorSequence.length)
    expect(project.revisionDraftSets[0].color).toBe('white')
    expect(project.revisionDraftSets.at(-1)?.color).toBe('tan')
  })

  it('tracks edits with revision color and right-margin asterisk metadata', () => {
    let project = createEmptyProject()
    const action = createBlock('action', 'Original line.')
    project.blocks = [action]
    project = beginNextRevisionSet(project, 'White draft')

    const result = updateBlockTextWithRevisionTracking(project, action.id, 'Changed line.')

    expect(result.blocked).toBe(false)
    expect(result.project.blocks[0].text).toBe('Changed line.')
    expect(result.project.blocks[0].revision).toBe('white')
    expect(result.project.blocks[0].revisionMark).toBe(true)
  })

  it('blocks locked scene edits until the scene is explicitly unlocked', () => {
    let project = createEmptyProject()
    const scene = createBlock('scene-heading', 'INT. OFFICE - DAY')
    const action = createBlock('action', 'A phone rings.')
    project.blocks = [scene, action]

    project = lockScene(project, scene.id)
    const blocked = updateBlockTextWithRevisionTracking(project, action.id, 'Changed.')

    expect(blocked.blocked).toBe(true)
    expect(blocked.project.blocks[1].text).toBe('A phone rings.')

    project = unlockScene(blocked.project, scene.id)
    const allowed = updateBlockTextWithRevisionTracking(project, action.id, 'Changed.')

    expect(allowed.blocked).toBe(false)
    expect(allowed.project.blocks[1].text).toBe('Changed.')
  })

  it('omits and un-omits scenes while preserving retired content', () => {
    let project = createEmptyProject()
    const scene = createBlock('scene-heading', 'INT. HALLWAY - NIGHT')
    project.blocks = [scene]

    project = omitScene(project, scene.id)
    expect(project.blocks[0].omitted).toBe(true)
    expect(project.blocks[0].text).toBe('(OMITTED)')
    expect(project.blocks[0].omittedText).toBe('INT. HALLWAY - NIGHT')

    project = unomitScene(project, scene.id)
    expect(project.blocks[0].omitted).toBe(false)
    expect(project.blocks[0].text).toBe('INT. HALLWAY - NIGHT')
  })

  it('creates A-page labels for overflow from a locked page number', () => {
    expect(buildAPageLabels(10, 4)).toEqual(['10', '10A', '10B', '10C'])
  })

  it('stashes selected dialogue and swaps it back into a dialogue block', () => {
    const project = createEmptyProject()
    const dialogue = createBlock('dialogue', 'Keep this alternate line for later.')
    project.blocks = [dialogue]

    const stashed = stashDialogueSelection(project, dialogue.id, 10, 24, 'Alternate')

    expect(stashed.project.dialogueStash).toHaveLength(1)
    expect(stashed.project.dialogueStash[0].text).toBe('alternate line')
    expect(stashed.project.blocks[0].text).toBe('Keep this  for later.')

    const swapped = swapStashIntoDialogue(
      stashed.project,
      stashed.project.dialogueStash[0].id,
      dialogue.id,
    )

    expect(swapped.blocks[0].text).toContain('alternate line')
    expect(swapped.dialogueStash).toHaveLength(0)
  })

  it('adds revision tint and asterisk marks to print layout metadata', () => {
    let project = createEmptyProject()
    const action = createBlock('action', 'Changed line.')
    action.revision = 'blue'
    action.revisionMark = true
    project.blocks = [action]
    project = beginNextRevisionSet(project, 'Blue draft')
    project.meta.activeRevision = 'blue'

    const layout = paginateProjectForPrint(project)
    const scriptPage = layout.pages.find((page) => page.kind === 'script')

    expect(scriptPage?.revisionColor).toBe('blue')
    expect(scriptPage?.lines.some((line) => line.role === 'revision-mark')).toBe(true)
  })
})
