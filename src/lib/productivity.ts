import type { ProductivitySettings, ScriptProject } from '../types/screenplay'
import { cloneProject } from './screenplay'

export interface GoalProgress {
  dailyPercent: number
  projectPercent: number
}

export interface SprintInput {
  minutes: number
  wordsStarted: number
  wordsEnded: number
  endedAt: string
}

export interface ReadThroughItem {
  id: string
  speaker: string
  text: string
  blockId: string
}

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

export const ensureProductivityState = (project: ScriptProject): ScriptProject => {
  const next = cloneProject(project)
  const fallback = {
    settings: {
      focusMode: false,
      typewriterMode: false,
      fullscreenMode: false,
    },
    goals: {
      dailyPageGoal: 5,
      projectPageGoal: 100,
      dailyPagesWritten: 0,
    },
    sprints: {
      activeMinutes: 25,
      remainingSeconds: 25 * 60,
      isRunning: false,
      sessions: [],
    },
    streak: {
      current: 0,
      longest: 0,
      lastWritingDate: null,
    },
    tts: {
      speed: 1,
      voiceByCharacter: {},
    },
  }

  next.productivity = {
    ...fallback,
    ...next.productivity,
    settings: {
      ...fallback.settings,
      ...next.productivity?.settings,
    },
    goals: {
      ...fallback.goals,
      ...next.productivity?.goals,
    },
    sprints: {
      ...fallback.sprints,
      ...next.productivity?.sprints,
      sessions: next.productivity?.sprints?.sessions ?? [],
    },
    streak: {
      ...fallback.streak,
      ...next.productivity?.streak,
    },
    tts: {
      ...fallback.tts,
      ...next.productivity?.tts,
      voiceByCharacter: next.productivity?.tts?.voiceByCharacter ?? {},
    },
  }

  return next
}

const percent = (value: number, target: number): number => {
  if (target <= 0) {
    return 0
  }

  return Math.min(100, Number(((value / target) * 100).toFixed(2)))
}

export const calculateGoalProgress = (
  project: ScriptProject,
  currentProjectPages: number,
): GoalProgress => {
  const hydrated = ensureProductivityState(project)
  return {
    dailyPercent: percent(
      hydrated.productivity.goals.dailyPagesWritten,
      hydrated.productivity.goals.dailyPageGoal,
    ),
    projectPercent: percent(
      currentProjectPages,
      hydrated.productivity.goals.projectPageGoal,
    ),
  }
}

export const logSprintSession = (
  project: ScriptProject,
  input: SprintInput,
): ScriptProject => {
  const next = ensureProductivityState(project)
  next.productivity.sprints.sessions.unshift({
    id: createId(),
    minutes: input.minutes,
    wordsStarted: input.wordsStarted,
    wordsEnded: input.wordsEnded,
    wordDelta: Math.max(0, input.wordsEnded - input.wordsStarted),
    endedAt: input.endedAt,
  })
  next.productivity.sprints.isRunning = false
  next.productivity.sprints.remainingSeconds = input.minutes * 60
  return next
}

const toDate = (date: string): Date => {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? new Date(date) : parsed
}

const daysBetween = (left: string, right: string): number => {
  const millis = toDate(right).getTime() - toDate(left).getTime()
  return Math.round(millis / 86_400_000)
}

export const updateWritingStreak = (
  project: ScriptProject,
  writingDate: string,
): ScriptProject => {
  const next = ensureProductivityState(project)
  const lastDate = next.productivity.streak.lastWritingDate

  if (!lastDate) {
    next.productivity.streak.current = 1
  } else if (lastDate === writingDate) {
    next.productivity.streak.current = Math.max(1, next.productivity.streak.current)
  } else if (daysBetween(lastDate, writingDate) === 1) {
    next.productivity.streak.current += 1
  } else {
    next.productivity.streak.current = 1
  }

  next.productivity.streak.longest = Math.max(
    next.productivity.streak.longest,
    next.productivity.streak.current,
  )
  next.productivity.streak.lastWritingDate = writingDate
  return next
}

export const buildReadThroughQueue = (project: ScriptProject): ReadThroughItem[] => {
  const queue: ReadThroughItem[] = []
  let activeCharacter: string | null = null

  for (const block of project.blocks) {
    if (block.type === 'character') {
      activeCharacter = block.text.trim().replace(/\(.+\)/, '').trim().toUpperCase()
      continue
    }

    if (block.type === 'dialogue' && activeCharacter) {
      queue.push({
        id: `${block.id}-read`,
        speaker: activeCharacter,
        text: block.text,
        blockId: block.id,
      })
      continue
    }

    if (block.type === 'action') {
      queue.push({
        id: `${block.id}-read`,
        speaker: 'Narrator',
        text: block.text,
        blockId: block.id,
      })
      activeCharacter = null
      continue
    }

    if (block.type === 'scene-heading') {
      activeCharacter = null
    }
  }

  return queue.filter((item) => item.text.trim())
}

export const assignCharacterVoices = (
  project: ScriptProject,
  voices: string[],
): ScriptProject => {
  const next = ensureProductivityState(project)
  const seen = new Set<string>()
  const characters: string[] = []

  for (const block of project.blocks) {
    if (block.type !== 'character') {
      continue
    }

    const character = block.text.trim().replace(/\(.+\)/, '').trim().toUpperCase()
    if (character && !seen.has(character)) {
      seen.add(character)
      characters.push(character)
    }
  }

  characters.forEach((character, index) => {
    next.productivity.tts.voiceByCharacter[character] =
      voices[index % Math.max(voices.length, 1)] ?? 'Default'
  })

  return next
}

export const setProductivityMode = (
  project: ScriptProject,
  key: keyof ProductivitySettings,
  value: boolean,
): ScriptProject => {
  const next = ensureProductivityState(project)
  next.productivity.settings[key] = value
  return next
}
