import { rolldown } from 'rolldown'
import { mkdir } from 'node:fs/promises'

await mkdir('tui/generated', { recursive: true })
const bundle = await rolldown({ input: 'src/tui/domain.ts' })
await bundle.write({ file: 'tui/generated/domain.js', format: 'iife', name: 'MasterScriptDomain', minify: true })
await bundle.close()
