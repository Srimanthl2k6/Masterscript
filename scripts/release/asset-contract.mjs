import { readFileSync, copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
export const manifest = JSON.parse(readFileSync(new URL('../../release-assets.json', import.meta.url), 'utf8'))
export const namesForRelease = version => manifest.artifacts.flatMap(item => [item.stable, item.versioned.replace('{version}', version)])
export function finalizePlatformAssets(directory, platform, version) {
  const targets = manifest.artifacts.filter(item => item.platform === platform || item.id === `tui-${platform === 'Windows' ? 'windows' : platform === 'macOS' ? 'macos' : 'linux'}`)
  for (const artifact of targets) {
    const versioned = join(directory, artifact.versioned.replace('{version}', version))
    if (!existsSync(versioned)) throw new Error(`Missing release artifact: ${versioned}`)
    copyFileSync(versioned, join(directory, artifact.stable))
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , directory, platform] = process.argv
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
  finalizePlatformAssets(directory, platform, version)
}
