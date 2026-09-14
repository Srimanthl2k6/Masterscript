import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

const directory = process.argv[2] ?? 'signed-assets'
const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'))
const latest = JSON.parse(readFileSync(join(directory, 'latest.json'), 'utf8'))
const temporary = mkdtempSync(join(tmpdir(), 'masterscript-signatures-'))
try {
  const publicKey = join(temporary, 'updater.pub')
  const signature = join(temporary, 'payload.minisig')
  const tampered = join(temporary, 'tampered-payload')
  writeFileSync(publicKey, Buffer.from(config.plugins.updater.pubkey, 'base64'))
  const filenames = new Set(Object.values(latest.platforms).map(platform => basename(new URL(platform.url).pathname)))
  for (const filename of filenames) {
    const payload = join(directory, filename)
    writeFileSync(signature, Buffer.from(readFileSync(`${payload}.sig`, 'utf8').trim(), 'base64'))
    execFileSync('minisign', ['-Vm', payload, '-p', publicKey, '-x', signature], { stdio: 'inherit' })
    const changed = readFileSync(payload)
    if (!changed.length) throw new Error(`Empty updater payload: ${filename}`)
    changed[0] ^= 1
    writeFileSync(tampered, changed)
    const rejected = spawnSync('minisign', ['-Vm', tampered, '-p', publicKey, '-x', signature], { encoding: 'utf8' })
    if (rejected.error || rejected.status !== 1 || !/Signature verification failed/i.test(rejected.stderr)) {
      throw new Error(`Tampered updater payload was not rejected as expected: ${filename}`)
    }
    console.log(`Verified configured updater key and rejected tampering: ${filename}`)
  }
} finally {
  for (const filename of readdirSync(temporary)) unlinkSync(join(temporary, filename))
  rmdirSync(temporary)
}
