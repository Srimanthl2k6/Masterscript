import { describe, expect, it } from 'vitest'
import { createBlock, createEmptyProject } from './screenplay'
import {
  assignCharacterVoices,
  buildReadThroughQueue,
  calculateGoalProgress,
  ensureProductivityState,
  logSprintSession,
  setProductivityMode,
  updateWritingStreak,
} from './productivity'

describe('writing productivity helpers', () => {
  it('calculates daily and project page goal progress', () => {
    const project = createEmptyProject()
    project.productivity.goals.dailyPageGoal = 5
    project.productivity.goals.projectPageGoal = 100
    project.productivity.goals.dailyPagesWritten = 2

    const progress = calculateGoalProgress(project, 40)

    expect(progress.dailyPercent).toBe(40)
    expect(progress.projectPercent).toBe(40)
  })

  it('logs sprint sessions with word-count delta', () => {
    const project = createEmptyProject()

    const updated = logSprintSession(project, {
      minutes: 25,
      wordsStarted: 100,
      wordsEnded: 180,
      endedAt: '2026-05-19T10:00:00.000Z',
    })

    expect(updated.productivity.sprints.sessions[0].wordDelta).toBe(80)
    expect(updated.productivity.sprints.sessions[0].minutes).toBe(25)
  })

  it('updates writing streak for consecutive writing days', () => {
    let project = createEmptyProject()

    project = updateWritingStreak(project, '2026-05-18')
    project = updateWritingStreak(project, '2026-05-19')

    expect(project.productivity.streak.current).toBe(2)
    expect(project.productivity.streak.longest).toBe(2)
  })

  it('builds a read-through queue with character ownership', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('scene-heading', 'INT. CAFE - DAY'),
      createBlock('action', 'Rain taps the window.'),
      createBlock('character', 'MAYA'),
      createBlock('dialogue', 'We wait.'),
      createBlock('character', 'JON'),
      createBlock('dialogue', 'Not for long.'),
    ]

    const queue = buildReadThroughQueue(project)

    expect(queue.map((item) => item.speaker)).toEqual(['Narrator', 'MAYA', 'JON'])
    expect(queue[1].text).toBe('We wait.')
  })

  it('assigns unique TTS voice names per character', () => {
    const project = createEmptyProject()
    project.blocks = [createBlock('character', 'MAYA'), createBlock('character', 'JON')]

    const updated = assignCharacterVoices(project, ['Voice A', 'Voice B'])

    expect(updated.productivity.tts.voiceByCharacter.MAYA).toBe('Voice A')
    expect(updated.productivity.tts.voiceByCharacter.JON).toBe('Voice B')
  })

  it('toggles focus, typewriter, and fullscreen modes', () => {
    let project = ensureProductivityState(createEmptyProject())

    project = setProductivityMode(project, 'focusMode', true)
    project = setProductivityMode(project, 'typewriterMode', true)
    project = setProductivityMode(project, 'fullscreenMode', true)

    expect(project.productivity.settings).toMatchObject({
      focusMode: true,
      typewriterMode: true,
      fullscreenMode: true,
    })
  })
})
