import type { DepartmentTagCategory, ScriptBlock, ScriptProject } from '../types/screenplay'
import { characterAliasIndex, normalizeCharacterName } from './characterNormalization'
import { parseSceneHeadingParts } from './sceneHeading'

export interface SceneOccurrence {
  key: string
  itemKey: string
  sceneId: string
  blockId: string
  category: DepartmentTagCategory
  name: string
  start: number
  end: number
  confidence: number
  evidence: string
  quantity?: number
}
export interface SceneAnalysis {
  sceneId: string
  sceneNumber: number
  sceneLabel: string
  heading: string
  location: string
  intExt: string
  dayNight: string
  words: number
  pageCount: number
  speakingCast: string[]
  cast: string[]
  nonSpeakingCast: string[]
  occurrences: SceneOccurrence[]
  source: 'local-rules-v1'
}

// Explicit evidence only. These rules never invent associated equipment or departments.
export const productionLexicon: Partial<Record<DepartmentTagCategory, string[]>> = {
  Props: ['backpack', 'cigarette', 'revolver', 'gun', 'pistol', 'rifle', 'knife', 'letter', 'phone', 'key', 'keys', 'wristwatch', 'briefcase', 'suitcase', 'book', 'notebook', 'bottle', 'glass', 'coffee cup', 'umbrella', 'flashlight', 'laptop', 'camera', 'handcuffs'],
  Vehicles: ['police cruiser', 'police car', 'ambulance', 'fire engine', 'school bus', 'motorcycle', 'bicycle', 'helicopter', 'airplane', 'taxi', 'truck', 'van', 'car', 'bus', 'boat', 'train'],
  Animals: ['dog', 'cat', 'horse', 'bird', 'snake', 'elephant', 'cow', 'goat', 'chicken'],
  Wardrobe: ['dress', 'coat', 'uniform', 'hat', 'boots', 'jacket', 'suit', 'helmet', 'mask', 'sari', 'shirt'],
  Makeup: ['blood', 'scar', 'bruise', 'tattoo', 'wound', 'burns'],
  VFX: ['hologram', 'portal', 'spaceship', 'invisible', 'levitates'],
  SFX: ['explosion', 'explodes', 'gunshot', 'gunfire', 'fire', 'flames', 'smoke', 'sparks'],
  Stunts: ['fight', 'fights', 'fighting', 'falls', 'fall', 'jumps', 'tackles', 'punches', 'kicks', 'car chase', 'crashes'],
  Music: ['song', 'music', 'singing', 'sings', 'guitar', 'piano', 'orchestra'],
  'Set Dressing': ['hospital bed', 'heart monitor', 'neon sign', 'poster', 'lamp', 'table', 'sofa', 'bed', 'chair', 'desk', 'curtains', 'wheelchair'],
}
const roles = 'nurse|waiter|waitress|guard|student|policeman|police officer|soldier|passenger|pedestrian|customer|child|children|worker|crowd|dancer|bystander'
const verbs = 'enters?|walks?|watches?|sits?|lies?|stands?|runs?|crosses?|opens?|closes?|carries|carrying|follows?|approaches?|looks?|turns?|places?|checks?|grabs?|holds?|picks?|takes?|smiles?|nods?|whispers?|shouts?|kneels?|stares?|waits?|drives?|climbs?|lights?|raises?|fights?|falls?|jumps?|punches?|kicks?|is|was'
const stopNames = new Set(['A', 'AN', 'THE', 'HE', 'SHE', 'IT', 'THEY', 'WE', 'I', 'YOU', 'HIS', 'HER', 'THEIR', 'SOMEONE', 'EVERYONE', 'NOBODY', 'SOMETHING', 'NOTHING', 'THIS', 'THAT', 'THERE', 'THEN', 'INT', 'EXT', 'DAY', 'NIGHT', 'RAIN', 'WIND', 'DOOR', 'BUILDING', 'ROOM', 'LIGHT', 'LIGHTS', 'SUN', ...Object.values(productionLexicon).flat().map(value => value.toUpperCase()), ...roles.split('|').map(value => value.toUpperCase())])
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const inferenceItemKey = (category: DepartmentTagCategory, name: string) => `${category}:${name.trim().replace(/\s+/g, ' ').toLowerCase()}`
const discoveredNames = (block: ScriptBlock): string[] => {
  if (block.omitted || block.type !== 'action') return []
  const names: string[] = []
  const pattern = new RegExp(`\\b([A-Z][a-zA-Z'’-]+(?: [A-Z][a-z'’-]+)?)\\s*(?=,\\s*\\d{1,3}\\b|\\s+(?:${verbs})\\b)`, 'g')
  for (const match of block.text.matchAll(pattern)) {
    const name = normalizeCharacterName(match[1])
    if (!name.split(' ').some(part => stopNames.has(part))) names.push(name)
  }
  return names
}

type NameIndex = Map<string, string>
const characterIndex = (project: ScriptProject): NameIndex => {
  const index: NameIndex = characterAliasIndex(project)
  const add = (name: string, canonical = name) => {
    const normalized = normalizeCharacterName(name)
    if (normalized && !index.has(normalized)) index.set(normalized, normalizeCharacterName(canonical))
  }
  for (const entry of project.catalog ?? []) if (entry.kind === 'character') add(entry.name)
  for (const entry of project.production?.breakdown ?? []) if (entry.kind === 'cast') add(entry.name)
  for (const block of project.blocks) {
    if (block.omitted) continue
    if (block.type === 'character' && !index.has(normalizeCharacterName(block.text))) add(block.text)
    for (const name of discoveredNames(block)) if (!index.has(name)) add(name)
  }
  return index
}

const numberWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, twenty: 20, thirty: 30, fifty: 50, hundred: 100 }
const analyzeScene = (blocks: ScriptBlock[], names: NameIndex): SceneAnalysis => {
  const heading = blocks[0]
  const parts = parseSceneHeadingParts(heading.text)
  const occurrences: SceneOccurrence[] = []
  const speaking = new Set<string>()
  const add = (block: ScriptBlock, category: DepartmentTagCategory, name: string, start: number, end: number, evidence: string, confidence = 0.85, quantity?: number) => {
    const itemKey = inferenceItemKey(category, name)
    // An occurrence's identity survives edits before its range. Repeated mentions have an ordinal.
    const ordinal = occurrences.filter(item => item.blockId === block.id && item.itemKey === itemKey).length
    occurrences.push({ key: `${block.id}:${itemKey}:${ordinal}`, itemKey, sceneId: heading.id, blockId: block.id, category, name, start, end, evidence, confidence, quantity })
  }
  if (!heading.omitted) {
    if (parts.location) add(heading, 'Locations', parts.location.toUpperCase(), 0, heading.text.length, 'scene heading', 1)
    let activeCharacter: string | undefined
    const namesPattern = names.size ? new RegExp(`\\b(?:${[...names.keys()].sort((a, b) => b.length - a.length).map(escapeRegex).join('|')})\\b(?!['’]s\\b)`, 'gi') : null
    for (const block of blocks) {
      if (block.omitted) continue
      if (block.type === 'character') {
        const rawName = normalizeCharacterName(block.text)
        activeCharacter = names.get(rawName) ?? rawName
        if (activeCharacter) add(block, 'Cast', activeCharacter, 0, block.text.length, 'character cue', 1)
      } else if (block.type === 'dialogue') {
        if (activeCharacter && block.text.trim()) speaking.add(activeCharacter)
      } else if (block.type !== 'parenthetical') activeCharacter = undefined
      if (!['action', 'shot', 'audio-description'].includes(block.type)) continue
      if (namesPattern) {
        for (const match of block.text.matchAll(namesPattern)) {
          const prefix = block.text.slice(Math.max(0, match.index - 45), match.index)
          if (/(?:photo(?:graph)? of|portrait of|picture of|remembers?|mentions?|thinks? (?:of|about)|talks? about|without)\s*$/i.test(prefix)) continue
          add(block, 'Cast', names.get(match[0].toUpperCase())!, match.index, match.index + match[0].length, 'named presence in action', 0.9)
        }
      }
      const extraPattern = new RegExp(`\\b(?:(a|an|\\d+|${Object.keys(numberWords).join('|')})\\s+)?(${roles})(s)?\\b`, 'gi')
      for (const match of block.text.matchAll(extraPattern)) {
        if (names.has(match[2].toUpperCase())) continue
        const amount = match[1]?.toLowerCase()
        const quantity = amount === 'a' || amount === 'an' ? 1 : numberWords[amount] ?? (Number(amount) || undefined)
        add(block, 'Extras', match[2].toUpperCase(), match.index, match.index + match[0].length, match[0], 0.9, quantity)
      }
      for (const [category, entries] of Object.entries(productionLexicon)) {
        const pattern = new RegExp(`\\b(?:${[...entries].sort((a, b) => b.length - a.length).map(escapeRegex).join('|')})\\b`, 'gi')
        for (const match of block.text.matchAll(pattern)) {
          const prefix = block.text.slice(Math.max(0, match.index - 32), match.index)
          if (/\b(?:no|without|imaginary|metaphorical)\s+(?:\w+\s+)?$/i.test(prefix)) continue
          if (category === 'Stunts' && /\b(?:rain|snow|leaves|temperature|night)\s*$/i.test(prefix)) continue
          if (category === 'SFX' && /\b(?:on|opens?|cease|under)\s*$/i.test(prefix) && /^fire$/i.test(match[0])) continue
          let name = match[0].toLowerCase()
          let start = match.index
          if (category === 'Wardrobe') {
            const color = prefix.match(/\b(white|black|red|blue|green|yellow|bloodstained|torn|wedding)\s+$/i)
            if (color) { name = `${color[1].toLowerCase()} ${name}`; start -= color[0].length }
          }
          if (name === 'bed' && /hospital/i.test(parts.location)) name = 'hospital bed'
          add(block, category as DepartmentTagCategory, name, start, match.index + match[0].length, 'explicit action text')
        }
      }
    }
  }
  const cast = [...new Set(occurrences.filter(item => item.category === 'Cast').map(item => item.name))].sort()
  const words = heading.omitted ? 0 : blocks.filter(block => !block.omitted).reduce((sum, block) => sum + block.text.trim().split(/\s+/).filter(Boolean).length, 0)
  return { sceneId: heading.id, sceneNumber: 0, sceneLabel: '', heading: heading.text, location: parts.location.toUpperCase(), intExt: parts.intExt, dayNight: parts.dayNight, words,
    pageCount: words ? Math.max(1, Math.ceil(words / 250)) : 0, cast, speakingCast: [...speaking].sort(), nonSpeakingCast: cast.filter(name => !speaking.has(name)), occurrences, source: 'local-rules-v1' }
}

/** Bounded scene cache. Recompute extraction only for changed scenes or changed global character knowledge. */
export const createSceneAnalyzer = () => {
  const cache = new Map<string, { signature: string; result: SceneAnalysis }>()
  let recomputed = 0
  return {
    get recomputedScenes() { return recomputed },
    clear() { cache.clear() },
    analyze(project: ScriptProject): SceneAnalysis[] {
      recomputed = 0
      const names = characterIndex(project)
      const knowledge = JSON.stringify([...names].sort())
      const scenes: ScriptBlock[][] = []
      for (const block of project.blocks) {
        if (block.type === 'scene-heading') scenes.push([])
        scenes.at(-1)?.push(block)
      }
      const live = new Set(scenes.map(blocks => blocks[0].id))
      for (const id of cache.keys()) if (!live.has(id)) cache.delete(id)
      return scenes.map((blocks, index) => {
        const id = blocks[0].id
        const signature = knowledge + JSON.stringify(blocks.map(block => [block.id, block.type, block.text, block.omitted]))
        let cached = cache.get(id)
        if (!cached || cached.signature !== signature) {
          cached = { signature, result: analyzeScene(blocks, names) }
          cache.set(id, cached)
          recomputed += 1
        }
        const sceneLabel = project.advanced.sceneNumbering.numbers[id] ?? String(index + 1)
        if (cached.result.sceneNumber !== index + 1 || cached.result.sceneLabel !== sceneLabel) {
          cached.result = { ...cached.result, sceneNumber: index + 1, sceneLabel }
        }
        return cached.result
      })
    },
  }
}
const analyzer = createSceneAnalyzer()
const projectCache = new WeakMap<ScriptProject, SceneAnalysis[]>()
export const analyzeProjectScenes = (project: ScriptProject): SceneAnalysis[] => {
  let result = projectCache.get(project)
  if (!result) { result = analyzer.analyze(project); projectCache.set(project, result) }
  return result
}
export const clearSceneAnalysisCache = () => analyzer.clear()
