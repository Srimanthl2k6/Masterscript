const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')
const fs = require('node:fs/promises')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { WebSocketServer, WebSocket } = require('ws')
const { configureAutoUpdates } = require('./auto-updater.cjs')
const { getRendererEntry } = require('./renderer-entry.cjs')

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)

const normalizeFileName = (value) =>
  (value || 'untitled-project')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled-project'

const getAutosavePath = () => path.join(app.getPath('userData'), 'autosave.msproj.json')

let collaborationHttpServer = null
let collaborationServer = null
let collaborationPort = null
let collaborationRoomId = null
const collaborationLastStateByRoom = new Map()

const createRoomId = () => `masterscript-${Date.now().toString(36)}`

const closeCollaborationServer = async () => {
  if (collaborationServer) {
    for (const client of collaborationServer.clients) {
      client.close()
    }
    collaborationServer.close()
    collaborationServer = null
  }

  if (collaborationHttpServer) {
    await new Promise((resolve) => {
      collaborationHttpServer.close(() => resolve())
    })
    collaborationHttpServer = null
  }

  collaborationPort = null
  collaborationRoomId = null
  collaborationLastStateByRoom.clear()
}

const getLanHostUrls = (port) => {
  const urls = []
  const interfaces = os.networkInterfaces()
  const addresses = Object.values(interfaces)
    .flat()
    .filter(
      (entry) =>
        entry &&
        !entry.internal &&
        (entry.family === 'IPv4' || entry.family === 4) &&
        typeof entry.address === 'string',
    )
    .map((entry) => entry.address)

  for (const address of addresses) {
    urls.push(`ws://${address}:${port}`)
  }

  urls.push(`ws://127.0.0.1:${port}`)
  return [...new Set(urls)]
}

const parseRoomIdFromRequest = (request, fallbackRoomId) => {
  try {
    const requestUrl = new URL(request.url || '/', 'ws://localhost')
    const roomPath = decodeURIComponent(requestUrl.pathname.replace(/^\/+/, ''))
    return roomPath || fallbackRoomId
  } catch {
    return fallbackRoomId
  }
}

const startCollaborationServer = async ({ roomId, port }) => {
  await closeCollaborationServer()

  const resolvedRoomId = roomId || createRoomId()
  const requestedPort = Number.isInteger(port) && port >= 0 ? port : 0
  const httpServer = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain' })
    response.end('MasterScript collaboration relay')
  })
  const websocketServer = new WebSocketServer({ server: httpServer })

  websocketServer.on('connection', (client, request) => {
    const clientRoomId = parseRoomIdFromRequest(request, resolvedRoomId)
    client.roomId = clientRoomId

    const lastState = collaborationLastStateByRoom.get(clientRoomId)
    if (lastState && client.readyState === WebSocket.OPEN) {
      client.send(lastState)
    }

    for (const peer of websocketServer.clients) {
      if (peer !== client && peer.roomId === clientRoomId && peer.readyState === WebSocket.OPEN) {
        peer.send(JSON.stringify({ type: 'sync-request' }))
      }
    }

    client.on('message', (message) => {
      const payload = Buffer.isBuffer(message) ? message.toString('utf8') : String(message)
      try {
        const parsed = JSON.parse(payload)
        if (parsed?.type === 'state') {
          collaborationLastStateByRoom.set(clientRoomId, payload)
        }
      } catch {
        // Non-JSON collaboration frames are still relayed, but not cached as room state.
      }

      for (const peer of websocketServer.clients) {
        if (peer !== client && peer.roomId === clientRoomId && peer.readyState === WebSocket.OPEN) {
          peer.send(payload)
        }
      }
    })
  })

  await new Promise((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(requestedPort, '0.0.0.0', () => {
      httpServer.off('error', reject)
      resolve()
    })
  })

  collaborationHttpServer = httpServer
  collaborationServer = websocketServer
  collaborationPort = httpServer.address().port
  collaborationRoomId = resolvedRoomId

  const hostUrls = getLanHostUrls(collaborationPort)
  return {
    ok: true,
    roomId: collaborationRoomId,
    port: collaborationPort,
    hostUrls,
    primaryHostUrl: hostUrls[0],
  }
}

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

  const rendererEntry = getRendererEntry({
    app,
    devServerUrl: process.env.VITE_DEV_SERVER_URL,
    isDev,
  })

  if (rendererEntry.type === 'url') {
    mainWindow.loadURL(rendererEntry.value)
  } else {
    mainWindow.loadFile(rendererEntry.value)
  }

  if (process.env.ELECTRON_DEBUG === 'true') {
    mainWindow.webContents.openDevTools()
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

ipcMain.handle('collaboration:lan-host', async (_event, payload) => {
  try {
    return await startCollaborationServer({
      roomId: typeof payload?.roomId === 'string' ? payload.roomId : undefined,
      port: Number.isInteger(payload?.port) ? payload.port : 0,
    })
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not start collaboration host',
    }
  }
})

ipcMain.handle('collaboration:lan-stop', async () => {
  await closeCollaborationServer()
  return { ok: true }
})

ipcMain.handle('collaboration:lan-status', async () => {
  const hostUrls = collaborationPort ? getLanHostUrls(collaborationPort) : []
  return {
    ok: true,
    running: Boolean(collaborationServer && collaborationHttpServer),
    roomId: collaborationRoomId,
    port: collaborationPort,
    hostUrls,
    primaryHostUrl: hostUrls[0],
  }
})

ipcMain.handle('collaboration:lan-join', async (_event, payload) => {
  const serverUrl = typeof payload?.serverUrl === 'string' ? payload.serverUrl.trim() : ''
  const roomId = typeof payload?.roomId === 'string' ? payload.roomId.trim() : ''
  if (!serverUrl || !roomId) {
    return { ok: false, error: 'LAN server URL and room ID are required' }
  }

  try {
    const parsedUrl = new URL(serverUrl)
    if (parsedUrl.protocol !== 'ws:' && parsedUrl.protocol !== 'wss:') {
      return { ok: false, error: 'LAN server URL must start with ws:// or wss://' }
    }
  } catch {
    return { ok: false, error: 'LAN server URL is invalid' }
  }

  return { ok: true, serverUrl, roomId }
})

app.whenReady().then(() => {
  createMainWindow()
  void configureAutoUpdates({ autoUpdater, isDev }).checkForUpdates()

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

app.on('before-quit', () => {
  void closeCollaborationServer()
})
