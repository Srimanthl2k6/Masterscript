import { readdir, stat, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const outputDirectory = path.join(root, 'analysis', 'tauri-pass1')

const directorySize = async (directory) => {
  let bytes = 0
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    bytes += entry.isDirectory() ? await directorySize(entryPath) : (await stat(entryPath)).size
  }
  return bytes
}

const listFiles = async (directory, prefix = '') => {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = path.join(prefix, entry.name)
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath, relativePath)))
    } else {
      files.push({ path: relativePath.replaceAll('\\', '/'), bytes: (await stat(entryPath)).size })
    }
  }
  return files
}

const distPath = path.join(root, 'dist')
const files = (await listFiles(distPath)).sort((left, right) => right.bytes - left.bytes)
const report = {
  recordedAt: new Date().toISOString(),
  distBytes: await directorySize(distPath),
  files,
}

await mkdir(outputDirectory, { recursive: true })
await writeFile(
  path.join(outputDirectory, 'electron-web-bundle-baseline.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
)

console.log(JSON.stringify(report, null, 2))
