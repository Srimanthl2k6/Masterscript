const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)

const normalizeFileName = (value) =>
  (value || 'untitled-project')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled-project'

const getAutosavePath = () => path.join(app.getPath('userData'), 'autosave.msproj.json')

const createMainWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1100,
    minHeight: 700,
    title: 'MasterScript',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

ipcMain.handle('project:autosave', async (_event, project) => {
  const autosavePath = getAutosavePath()
  await fs.mkdir(path.dirname(autosavePath), { recursive: true })
  await fs.writeFile(autosavePath, JSON.stringify(project, null, 2), 'utf8')
  return { ok: true }
})

ipcMain.handle('project:read-autosave', async () => {
  try {
    const raw = await fs.readFile(getAutosavePath(), 'utf8')
    return { ok: true, project: JSON.parse(raw) }
  } catch {
    return { ok: true, project: null }
  }
})

ipcMain.handle('project:save-file', async (_event, payload) => {
  const project = payload?.project
  const title = payload?.title ?? 'Untitled'
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save MasterScript project',
    defaultPath: `${normalizeFileName(title)}.msproj.json`,
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
  })

  if (canceled || !filePath) {
    return { ok: false, cancelled: true }
  }

  await fs.writeFile(filePath, JSON.stringify(project, null, 2), 'utf8')
  return { ok: true, path: filePath }
})

ipcMain.handle('project:open-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open MasterScript project',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile'],
  })

  if (canceled || filePaths.length === 0) {
    return { ok: false, cancelled: true }
  }

  const selectedFile = filePaths[0]
  const raw = await fs.readFile(selectedFile, 'utf8')
  return {
    ok: true,
    path: selectedFile,
    project: JSON.parse(raw),
  }
})

ipcMain.handle('project:open-path', async (_event, filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    return { ok: false, error: 'Missing file path' }
  }

  const resolvedPath = path.resolve(filePath)
  const raw = await fs.readFile(resolvedPath, 'utf8')
  return {
    ok: true,
    path: resolvedPath,
    project: JSON.parse(raw),
  }
})

ipcMain.handle('project:export-fountain', async (_event, payload) => {
  const title = payload?.title ?? 'Untitled'
  const content = payload?.content ?? ''
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export Fountain file',
    defaultPath: `${normalizeFileName(title)}.fountain`,
    filters: [{ name: 'Fountain', extensions: ['fountain', 'txt'] }],
  })

  if (canceled || !filePath) {
    return { ok: false, cancelled: true }
  }

  await fs.writeFile(filePath, content, 'utf8')
  return { ok: true, path: filePath }
})

ipcMain.handle('project:import-fdx', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import Final Draft (FDX)',
    filters: [{ name: 'FDX', extensions: ['fdx', 'xml', 'txt'] }],
    properties: ['openFile'],
  })

  if (canceled || filePaths.length === 0) {
    return { ok: false, cancelled: true }
  }

  const selectedFile = filePaths[0]
  const content = await fs.readFile(selectedFile, 'utf8')
  return { ok: true, path: selectedFile, content }
})

ipcMain.handle('project:import-fountain', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import Fountain',
    filters: [{ name: 'Fountain', extensions: ['fountain', 'txt'] }],
    properties: ['openFile'],
  })

  if (canceled || filePaths.length === 0) {
    return { ok: false, cancelled: true }
  }

  const selectedFile = filePaths[0]
  const content = await fs.readFile(selectedFile, 'utf8')
  return { ok: true, path: selectedFile, content }
})

ipcMain.handle('project:export-fdx', async (_event, payload) => {
  const title = payload?.title ?? 'Untitled'
  const content = payload?.content ?? ''
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export Final Draft (FDX)',
    defaultPath: `${normalizeFileName(title)}.fdx`,
    filters: [{ name: 'Final Draft', extensions: ['fdx'] }],
  })

  if (canceled || !filePath) {
    return { ok: false, cancelled: true }
  }

  await fs.writeFile(filePath, content, 'utf8')
  return { ok: true, path: filePath }
})

ipcMain.handle('project:import-docx', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import DOCX',
    filters: [{ name: 'Word Documents', extensions: ['docx'] }],
    properties: ['openFile'],
  })

  if (canceled || filePaths.length === 0) {
    return { ok: false, cancelled: true }
  }

  const selectedFile = filePaths[0]
  const buffer = await fs.readFile(selectedFile)
  return {
    ok: true,
    path: selectedFile,
    base64: buffer.toString('base64'),
  }
})

ipcMain.handle('project:export-docx', async (_event, payload) => {
  const title = payload?.title ?? 'Untitled'
  const base64 = payload?.base64 ?? ''
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export DOCX',
    defaultPath: `${normalizeFileName(title)}.docx`,
    filters: [{ name: 'Word Documents', extensions: ['docx'] }],
  })

  if (canceled || !filePath) {
    return { ok: false, cancelled: true }
  }

  await fs.writeFile(filePath, Buffer.from(base64, 'base64'))
  return { ok: true, path: filePath }
})

ipcMain.handle('project:export-pdf', async (_event, payload) => {
  const title = payload?.title ?? 'Untitled'
  const base64 = payload?.base64 ?? ''
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export PDF',
    defaultPath: `${normalizeFileName(title)}.pdf`,
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
  })

  if (canceled || !filePath) {
    return { ok: false, cancelled: true }
  }

  await fs.writeFile(filePath, Buffer.from(base64, 'base64'))
  return { ok: true, path: filePath }
})

app.whenReady().then(() => {
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
