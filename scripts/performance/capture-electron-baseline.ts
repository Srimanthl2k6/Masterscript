import { execFileSync, spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { WebSocket } from 'ws'

const root = process.cwd()
const outputDirectory = path.join(root, 'analysis', 'tauri-pass1')
const screenshotDirectory = path.join(outputDirectory, 'screenshots', 'windows')
const profileDirectory = path.join(outputDirectory, '.electron-benchmark-profile')
const electronExecutable = path.join(
  root,
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron',
)
const debuggingPort = 9338

interface CdpResponse {
  id?: number
  result?: Record<string, unknown>
  error?: { message: string }
}

const waitForDebugTarget = async () => {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`)
      const targets = (await response.json()) as Array<{
        type: string
        webSocketDebuggerUrl: string
      }>
      const page = targets.find((target) => target.type === 'page')
      if (page) {
        return page.webSocketDebuggerUrl
      }
    } catch {
      // The remote-debugging endpoint is not ready yet.
    }
    await delay(100)
  }
  throw new Error('Electron remote-debugging target did not become ready')
}

const createCdpClient = async (url: string) => {
  const socket = new WebSocket(url)
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve)
    socket.once('error', reject)
  })

  let nextId = 1
  const pending = new Map<
    number,
    { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void }
  >()

  socket.on('message', (raw) => {
    const message = JSON.parse(String(raw)) as CdpResponse
    if (!message.id) {
      return
    }
    const request = pending.get(message.id)
    if (!request) {
      return
    }
    pending.delete(message.id)
    if (message.error) {
      request.reject(new Error(message.error.message))
    } else {
      request.resolve(message.result ?? {})
    }
  })

  const send = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const id = nextId
      nextId += 1
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })

  return { socket, send }
}

const evaluate = async (
  send: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>,
  expression: string,
) => {
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  const result = response.result as { value?: unknown } | undefined
  return result?.value
}

const waitForSelector = async (
  send: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>,
  selector: string,
) => {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (await evaluate(send, `Boolean(document.querySelector(${JSON.stringify(selector)}))`)) {
      return
    }
    await delay(100)
  }
  throw new Error(`Timed out waiting for ${selector}`)
}

const waitForExpression = async (
  send: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>,
  expression: string,
  description: string,
) => {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (await evaluate(send, expression)) {
      return
    }
    await delay(100)
  }
  throw new Error(`Timed out waiting for ${description}`)
}

const captureScreenshot = async (
  send: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>,
  name: string,
) => {
  const response = await send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  })
  await writeFile(
    path.join(screenshotDirectory, `${name}.png`),
    Buffer.from(String(response.data), 'base64'),
  )
}

const measureElectronProcesses = (startedAt: Date) => {
  if (process.platform !== 'win32') {
    return null
  }

  const command = `
    $started = [datetime]::Parse('${startedAt.toISOString()}')
    $processes = Get-Process electron -ErrorAction SilentlyContinue |
      Where-Object { $_.StartTime -ge $started }
    $result = [ordered]@{
      processCount = @($processes).Count
      workingSetBytes = ($processes | Measure-Object WorkingSet64 -Sum).Sum
      privateBytes = ($processes | Measure-Object PrivateMemorySize64 -Sum).Sum
    }
    $result | ConvertTo-Json -Compress
  `

  return JSON.parse(
    execFileSync('powershell.exe', ['-NoProfile', '-Command', command], {
      encoding: 'utf8',
    }),
  ) as {
    processCount: number
    workingSetBytes: number
    privateBytes: number
  }
}

await mkdir(screenshotDirectory, { recursive: true })
await rm(profileDirectory, { recursive: true, force: true })

const startedAt = new Date()
const electronEnvironment = {
  ...process.env,
  VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173',
}
delete electronEnvironment.ELECTRON_RUN_AS_NODE
const electron = spawn(
  electronExecutable,
  [
    '.',
    '--headless',
    '--remote-debugging-port=9338',
    `--user-data-dir=${profileDirectory}`,
  ],
  {
    cwd: root,
    env: electronEnvironment,
    stdio: 'ignore',
    windowsHide: true,
  },
)

try {
  const webSocketUrl = await waitForDebugTarget()
  const startupMs = Date.now() - startedAt.getTime()
  const { socket, send } = await createCdpClient(webSocketUrl)
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Performance.enable')
  await waitForSelector(send, '.home-shell')
  await captureScreenshot(send, 'home')
  await delay(750)
  const idleProcessMemory = measureElectronProcesses(startedAt)

  const fixtureReports = []
  for (const fixtureName of ['small', 'medium', 'large-200-page']) {
    const fixturePath = path.join(
      outputDirectory,
      'fixtures',
      `${fixtureName}.msproj.json`,
    )
    const project = JSON.parse(await readFile(fixturePath, 'utf8')) as {
      id: string
      meta: { title: string }
    }
    const recentEntry = {
      label: `${fixtureName} benchmark fixture`,
      source: 'project',
      updatedAt: '2026-06-21T00:00:00.000Z',
      projectId: project.id,
    }
    const seedExpression = `(() => {
      localStorage.setItem('masterscript-recent-v1', ${JSON.stringify(
        JSON.stringify([recentEntry]),
      )});
      localStorage.setItem('masterscript-recent-project-snapshots-v1', ${JSON.stringify(
        JSON.stringify({ [project.id]: project }),
      )});
      return true;
    })()`
    await evaluate(send, seedExpression)
    await send('Page.reload', { ignoreCache: true })
    await delay(1_500)
    await waitForSelector(send, '.home-recent-item')
    await evaluate(send, "document.querySelector('.home-recent-item').click()")
    await waitForSelector(send, '.workspace-shell')
    await waitForExpression(
      send,
      `document.querySelector('.project-title-input')?.value === ${JSON.stringify(
        project.meta.title,
      )}`,
      `${project.meta.title} to load`,
    )
    await delay(750)
    await captureScreenshot(send, fixtureName)

    const performance = await send('Performance.getMetrics')
    const metrics = Object.fromEntries(
      ((performance.metrics ?? []) as Array<{ name: string; value: number }>).map(
        (metric) => [metric.name, metric.value],
      ),
    )
    fixtureReports.push({
      fixture: fixtureName,
      title: project.meta.title,
      processMemory: measureElectronProcesses(startedAt),
      rendererJsHeapUsedBytes: metrics.JSHeapUsedSize ?? null,
      rendererDomNodes: metrics.Nodes ?? null,
      rendererDocuments: metrics.Documents ?? null,
    })
  }

  socket.close()
  const report = {
    recordedAt: new Date().toISOString(),
    platform: process.platform,
    architecture: process.arch,
    electronVersion: process.env.npm_package_devDependencies_electron ?? '41.2.0',
    method: 'Electron --headless with the unchanged Vite renderer and CDP',
    startupMs,
    idleProcessMemory,
    fixtures: fixtureReports,
  }
  await writeFile(
    path.join(outputDirectory, 'electron-runtime-baseline.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  )
  console.log(JSON.stringify(report, null, 2))
} finally {
  electron.kill()
  await delay(500)
  await rm(profileDirectory, { recursive: true, force: true })
}
