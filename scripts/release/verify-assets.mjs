import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { manifest, namesForRelease } from './asset-contract.mjs'

const directory = process.argv[2] ?? 'signed-assets'
const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const files = new Set(readdirSync(directory))
const required = [...namesForRelease(version), 'MasterScript.app.tar.gz', 'MasterScript.app.tar.gz.sig', 'MasterScript.Setup.exe.sig', 'MasterScript.linux.x86_64.AppImage.sig', 'latest.json', 'PKGBUILD', '.SRCINFO', 'release-checksums.sha256']
for (const name of required) if (!files.has(name)) throw new Error(`Missing ${name}`)
const digest = filename => createHash('sha256').update(readFileSync(join(directory, filename))).digest('hex')
for (const artifact of manifest.artifacts) {
  if (digest(artifact.stable) !== digest(artifact.versioned.replace('{version}', version))) throw new Error(`Alias differs from versioned artifact: ${artifact.stable}`)
}
const archName = `MasterScript.linux.${version}.x86_64.pkg.tar.zst`
const archHash = digest(archName)
for (const filename of ['PKGBUILD', '.SRCINFO']) {
  const metadata = readFileSync(join(directory, filename), 'utf8')
  if (!metadata.includes(archHash) || !metadata.includes(`/releases/download/v${version}/${archName}`) || metadata.includes("'SKIP'")) throw new Error(`Invalid AUR source/checksum: ${filename}`)
}
const latest = JSON.parse(readFileSync(join(directory, 'latest.json'), 'utf8'))
if (latest.version !== version) throw new Error('Updater version mismatch')
for (const platform of ['windows-x86_64', 'darwin-x86_64', 'darwin-aarch64', 'linux-x86_64']) {
  const item = latest.platforms[platform]
  if (!item?.signature || !item.url.startsWith(`https://github.com/Srimanthl2k6/Masterscript/releases/download/v${version}/`)) throw new Error(`Invalid updater platform ${platform}`)
  const filename = basename(new URL(item.url).pathname)
  if (!files.has(filename) || readFileSync(join(directory, `${filename}.sig`), 'utf8').trim() !== item.signature.trim()) throw new Error(`Updater signature mismatch: ${platform}`)
}
const checksums = readFileSync(join(directory, 'release-checksums.sha256'), 'utf8')
const covered = new Set()
for (const line of checksums.trim().split('\n')) {
  const match = line.match(/^([a-f0-9]{64})\s+\*?(?:\.\/)?(.+)$/)
  if (!match || basename(match[2]) !== match[2]) throw new Error('Invalid checksum path')
  const [, expected, filename] = match
  if (createHash('sha256').update(readFileSync(join(directory, filename))).digest('hex') !== expected) throw new Error(`Checksum mismatch: ${filename}`)
  covered.add(filename)
}
for (const name of required.filter(name => name !== 'release-checksums.sha256')) if (!covered.has(name)) throw new Error(`Unchecksummed asset ${name}`)
console.log(`Verified ${required.length} required release assets, updater URLs/signatures and checksum coverage.`)
