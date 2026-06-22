import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const commands = readFileSync('src-tauri/src/commands.rs', 'utf8')
const importSecurity = readFileSync('src-tauri/src/import_security.rs', 'utf8')
const migration = readFileSync('src-tauri/src/migration.rs', 'utf8')
const app = readFileSync('src/App.tsx', 'utf8')
const workerClient = readFileSync(
  'src/lib/adapters/importWorkerClient.ts',
  'utf8',
)
const docxAdapter = readFileSync('src/lib/adapters/docx.ts', 'utf8')

describe('Pass 3 import and migration hardening', () => {
  it('bounds desktop text and DOCX inputs before returning them to the webview', () => {
    expect(importSecurity).toContain('10 * 1024 * 1024')
    expect(importSecurity).toContain('25 * 1024 * 1024')
    expect(importSecurity).toContain('100 * 1024 * 1024')
    expect(importSecurity).toContain('DOCX_ENTRY_LIMIT: usize = 10_000')
    expect(importSecurity).toContain('DOCX_COMPRESSION_RATIO_LIMIT: u64 = 200')
    expect(commands).toContain('validate_docx_archive(&bytes)')
    expect(commands).not.toContain('tokio::fs::read_to_string')
  })

  it('runs all document conversion through a terminating worker', () => {
    expect(workerClient).toContain('timeoutMs = 15_000')
    expect(workerClient).toContain('worker.terminate()')
    expect(app.match(/runImportConversion\(/g)?.length).toBe(6)
    expect(app).not.toContain('importFountainProject')
    expect(app).not.toContain('importFdxProject')
    expect(app).not.toContain('importDocxProject')
  })

  it('keeps Mammoth external-file access disabled', () => {
    expect(docxAdapter).toContain('externalFileAccess: false')
  })

  it('writes a bounded migration report and canonicalizes legacy autosaves', () => {
    expect(migration).toContain('migration-report-v1.json')
    expect(migration).toContain('validate_trusted_legacy_autosave')
    expect(migration).toContain('Skipped invalid or unsupported migration manifest')
    expect(importSecurity).toContain('candidate.parent() != Some(root.as_path())')
  })
})
