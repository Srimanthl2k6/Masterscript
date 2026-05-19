import { createStoryCard } from './screenplay'
import type { StoryCard } from '../types/screenplay'

export interface StoryTemplate {
  id: string
  name: string
  beats: Array<{ title: string; beat: string }>
}

export const storyTemplates: StoryTemplate[] = [
  {
    id: 'three-act',
    name: 'Three Act Structure',
    beats: [
      { title: 'Act I - Setup', beat: 'Introduce protagonist, world, and dramatic tension.' },
      { title: 'Inciting Incident', beat: 'Trigger event that disrupts the status quo.' },
      { title: 'Act II - Rising Conflict', beat: 'Escalate stakes through trials and reversals.' },
      { title: 'Midpoint Shift', beat: 'Major reveal or irreversible turning point.' },
      { title: 'Act II - Crisis', beat: 'Push protagonist to a seemingly impossible low point.' },
      { title: 'Act III - Resolution', beat: 'Final confrontation and transformed outcome.' },
    ],
  },
  {
    id: 'hero-journey',
    name: "Hero's Journey",
    beats: [
      { title: 'Ordinary World', beat: 'Establish baseline life before disruption.' },
      { title: 'Call to Adventure', beat: 'Opportunity or threat invites change.' },
      { title: 'Refusal and Mentor', beat: 'Resistance appears, guidance follows.' },
      { title: 'Crossing the Threshold', beat: 'Commit to entering unfamiliar territory.' },
      { title: 'Trials and Allies', beat: 'Build capability and relationships under pressure.' },
      { title: 'Ordeal', beat: 'Face the core fear or adversary directly.' },
      { title: 'Reward and Return', beat: 'Claim insight, then navigate the way back.' },
      { title: 'Resurrection and Elixir', beat: 'Final test proves change and delivers value.' },
    ],
  },
  {
    id: 'sequence-approach',
    name: 'Eight Sequence Approach',
    beats: [
      { title: 'Sequence 1', beat: 'Hook, setup, and first dramatic complication.' },
      { title: 'Sequence 2', beat: 'Pressure intensifies and Act I break lands.' },
      { title: 'Sequence 3', beat: 'New world adaptation and first setback.' },
      { title: 'Sequence 4', beat: 'Complications stack toward midpoint.' },
      { title: 'Sequence 5', beat: 'Midpoint fallout and strategic shift.' },
      { title: 'Sequence 6', beat: 'Escalation to major crisis.' },
      { title: 'Sequence 7', beat: 'Lowest point and commitment to final push.' },
      { title: 'Sequence 8', beat: 'Climax, resolution, and emotional aftertaste.' },
    ],
  },
]

export const buildCardsFromTemplate = (templateId: string): StoryCard[] => {
  const template = storyTemplates.find((entry) => entry.id === templateId)
  if (!template) {
    return []
  }

  return template.beats.map((beat) => {
    const card = createStoryCard(beat.title)
    card.beat = beat.beat
    return card
  })
}
