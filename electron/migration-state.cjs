const fs = require('node:fs/promises')
const path = require('node:path')

const readJsonFile = async (filePath) => {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

const writeJsonAtomic = async (filePath, value) => {
  const temporaryPath = `${filePath}.tmp`
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await fs.rename(temporaryPath, filePath)
}

const recoverAtomicJsonFile = async (filePath) => {
  try {
    const current = await readJsonFile(filePath)
    if (current) {
      await fs.rm(`${filePath}.tmp`, { force: true })
      return current
    }
  } catch {
    return null
  }

  try {
    const pending = await readJsonFile(`${filePath}.tmp`)
    if (!pending) {
      return null
    }
    await fs.rename(`${filePath}.tmp`, filePath)
    return pending
  } catch {
    return null
  }
}

const withoutExportTimestamp = (manifest) => {
  const { exportedAt: _exportedAt, ...comparable } = manifest
  return comparable
}

const sameLogicalManifest = (left, right) =>
  JSON.stringify(withoutExportTimestamp(left)) ===
  JSON.stringify(withoutExportTimestamp(right))

const corruptBackupPath = (filePath, now) => {
  const timestamp = now.toISOString().replace(/[:.]/g, '-')
  return filePath.replace(/\.json$/i, `.corrupt-${timestamp}.json`)
}

const exportLegacyMigrationState = async ({
  manifest,
  manifestPath,
  installStatePath,
  autosavePath,
  now = () => new Date(),
}) => {
  const installState = {
    tutorialCompleted: true,
    legacyInstall: true,
    migrationVersion: 1,
  }
  await writeJsonAtomic(installStatePath, installState)

  let current = await recoverAtomicJsonFile(manifestPath)
  if (!current) {
    try {
      current = await readJsonFile(manifestPath)
    } catch {
      await fs.rename(manifestPath, corruptBackupPath(manifestPath, now()))
      current = null
    }
  }

  const normalized = {
    ...manifest,
    schemaVersion: 1,
    exportedAt:
      typeof manifest?.exportedAt === 'string'
        ? manifest.exportedAt
        : now().toISOString(),
    legacyInstall: true,
    tutorialCompleted: true,
    autosavePath,
  }

  if (current && sameLogicalManifest(current, normalized)) {
    return { ok: true, changed: false, path: manifestPath }
  }

  await writeJsonAtomic(manifestPath, normalized)
  return { ok: true, changed: true, path: manifestPath }
}

module.exports = {
  exportLegacyMigrationState,
  recoverAtomicJsonFile,
  writeJsonAtomic,
}
