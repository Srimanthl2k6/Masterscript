import { describe, expect, it } from 'vitest'
import { isLikelyLocalProjectPath } from './projectPath'

describe('isLikelyLocalProjectPath', () => {
  it.each([
    'C:\\Scripts\\draft.msproj.json',
    '\\\\server\\scripts\\draft.msproj.json',
    '/Users/writer/Scripts/draft.msproj.json',
    '/home/writer/scripts/draft.msproj.json',
  ])('accepts native project paths on every desktop platform: %s', (filePath) => {
    expect(isLikelyLocalProjectPath(filePath)).toBe(true)
  })

  it('rejects browser download labels and other file formats', () => {
    expect(isLikelyLocalProjectPath('draft.msproj.json')).toBe(false)
    expect(isLikelyLocalProjectPath('/tmp/draft.json')).toBe(false)
  })
})
