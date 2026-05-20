import { createRequire } from 'node:module'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { getRendererEntry } = require('./renderer-entry.cjs')

describe('renderer entry resolution', () => {
  it('loads the Vite dev server in development', () => {
    expect(
      getRendererEntry({
        app: { getAppPath: () => 'C:\\app\\resources\\app.asar' },
        devServerUrl: 'http://localhost:5173',
        isDev: true,
      }),
    ).toEqual({ type: 'url', value: 'http://localhost:5173' })
  })

  it('loads dist/index.html from app.getAppPath in packaged production', () => {
    const appPath = path.join('C:\\Program Files', 'MasterScript', 'resources', 'app.asar')

    expect(
      getRendererEntry({
        app: { getAppPath: () => appPath },
        devServerUrl: undefined,
        isDev: false,
      }),
    ).toEqual({
      type: 'file',
      value: path.join(appPath, 'dist', 'index.html'),
    })
  })
})
