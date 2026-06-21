import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('collaboration idle loading', () => {
  it('does not statically load Yjs providers before collaboration starts', () => {
    const source = readFileSync(
      new URL('./useCollaborationSession.ts', import.meta.url),
      'utf8',
    )

    expect(source).not.toMatch(/import \* as Y from 'yjs'/)
    expect(source).not.toMatch(/from 'y-indexeddb'/)
    expect(source).not.toMatch(/from 'y-webrtc'/)
    expect(source).not.toMatch(/from '\.\/encryptedLanProvider'/)
    expect(source).not.toMatch(/from '\.\/projectYjs'/)
  })
})
