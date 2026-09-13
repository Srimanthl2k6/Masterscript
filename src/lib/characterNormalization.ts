import type { ScriptProject } from '../types/screenplay'

export const normalizeCharacterName = (value: string): string =>
  value.trim().replace(/\s*\([^)]*\)?\s*$/, '').trim().replace(/\s+/g, ' ').toUpperCase()

export const characterAliasIndex = (project: ScriptProject): Map<string, string> => {
  const index = new Map<string, string>()
  for (const profile of Object.values(project.characters?.profiles ?? {})) {
    const name = normalizeCharacterName(profile.name)
    if (!name) continue
    index.set(name, name)
    for (const alias of profile.aliases ?? []) index.set(normalizeCharacterName(alias), name)
  }
  return index
}
