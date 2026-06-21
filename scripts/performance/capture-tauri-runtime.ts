import { execFileSync, spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { WebSocket } from 'ws'

const root = process.cwd()
const outputDirectory = path.join(root, 'analysis', 'tauri-pass8')
const executable =
  process.argv.find((argument) => argument.startsWith('--executable='))?.slice(13) ??
  path.join(root, 'src-tauri', 'target', 'release', 'masterscript.exe')
const installer = process.argv
  .find((argument) => argument.startsWith('--installer='))
  ?.slice(12)
const debuggingPort = 9339

interface CdpResponse {
  id?: number
  result?: Record<string, unknown>
  error?: { message: string }
}

const waitForDebugTarget = async () => {
  const deadline = Date.now() + 30_000
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
      // WebView2 has not opened its debugging endpoint yet.
    }
    await delay(100)
  }
  throw new Error('Tauri WebView2 debugging target did not become ready')
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

type Send = (
  method: string,
  params?: Record<string, unknown>,
) => Promise<Record<string, unknown>>

const evaluate = async (send: Send, expression: string) => {
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  return (response.result as { value?: unknown } | undefined)?.value
}

const waitForSelector = async (send: Send, selector: string) => {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (
      await evaluate(
        send,
        `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
      )
    ) {
      return
    }
    await delay(100)
  }
  throw new Error(`Timed out waiting for ${selector}`)
}

const measureProcessTree = (rootPid: number) => {
  const command = `
    $all = Get-CimInstance Win32_Process
    $ids = [System.Collections.Generic.HashSet[int]]::new()
    [void]$ids.Add(${rootPid})
    do {
      $before = $ids.Count
      foreach ($process in $all) {
        if ($ids.Contains([int]$process.ParentProcessId)) {
          [void]$ids.Add([int]$process.ProcessId)
        }
      }
    } while ($ids.Count -gt $before)
    $processes = Get-Process -Id @($ids) -ErrorAction SilentlyContinue
    [ordered]@{
      processCount = @($processes).Count
      workingSetBytes = [int64](($processes | Measure-Object WorkingSet64 -Sum).Sum)
      privateBytes = [int64](($processes | Measure-Object PrivateMemorySize64 -Sum).Sum)
    } | ConvertTo-Json -Compress
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

const measureInstalledFootprint = () => {
  if (!installer) {
    return null
  }
  execFileSync(installer, ['/S'], { stdio: 'inherit' })
  const command = `
    $entry = Get-ChildItem HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall -ErrorAction SilentlyContinue |
      Get-ItemProperty |
      Where-Object { $_.DisplayName -eq 'MasterScript' } |
      Select-Object -First 1
    $location = ([string]$entry.InstallLocation).Trim('"')
    if (-not $location) { throw 'MasterScript install location was not registered' }
    $files = Get-ChildItem -LiteralPath $location -Recurse |
      Where-Object { -not $_.PSIsContainer }
    [ordered]@{
      path = $location
      fileCount = @($files).Count
      installedBytes = [int64](($files | Measure-Object Length -Sum).Sum)
    } | ConvertTo-Json -Compress
  `
  return JSON.parse(
    execFileSync('powershell.exe', ['-NoProfile', '-Command', command], {
      encoding: 'utf8',
    }),
  ) as { path: string; fileCount: number; installedBytes: number }
}

await mkdir(outputDirectory, { recursive: true })
const startedAt = Date.now()
const app = spawn(executable, [], {
  cwd: root,
  env: {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${debuggingPort}`,
  },
  stdio: 'ignore',
  windowsHide: true,
})

try {
  if (!app.pid) {
    throw new Error('Tauri process did not start')
  }
  const webSocketUrl = await waitForDebugTarget()
  const startupMs = Date.now() - startedAt
  const { socket, send } = await createCdpClient(webSocketUrl)
  await send('Runtime.enable')
  await send('Performance.enable')
  await waitForSelector(send, '.home-shell')
  await evaluate(
    send,
    `window.__TAURI_INTERNALS__.invoke('installation_set_tutorial_completed', { completed: true })`,
  )
  await send('Page.reload', { ignoreCache: true })
  await waitForSelector(send, '.home-shell')
  await delay(750)
  const idleProcessMemory = measureProcessTree(app.pid)

  const fixtureReports = []
  for (const fixtureName of ['small', 'medium', 'large-200-page']) {
    const fixturePath = path.join(
      root,
      'analysis',
      'tauri-pass1',
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
      updatedAt: new Date().toISOString(),
      projectId: project.id,
    }
    await evaluate(
      send,
      `window.__TAURI_INTERNALS__.invoke('project_write_recent_snapshot', { project: ${JSON.stringify(
        project,
      )} })`,
    )
    await evaluate(
      send,
      `localStorage.setItem('masterscript-recent-v1', ${JSON.stringify(
        JSON.stringify([recentEntry]),
      )})`,
    )
    await send('Page.reload', { ignoreCache: true })
    await waitForSelector(send, '.home-recent-item')
    await evaluate(send, "document.querySelector('.home-recent-item').click()")
    await waitForSelector(send, '.workspace-shell')
    await delay(1_000)

    const performance = await send('Performance.getMetrics')
    const metrics = Object.fromEntries(
      ((performance.metrics ?? []) as Array<{ name: string; value: number }>).map(
        (metric) => [metric.name, metric.value],
      ),
    )
    fixtureReports.push({
      fixture: fixtureName,
      title: project.meta.title,
      processMemory: measureProcessTree(app.pid),
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
    version: '0.2.0',
    method: 'Tauri 2 WebView2 production binary with CDP',
    startupMs,
    idleProcessMemory,
    fixtures: fixtureReports,
    installedTauri: measureInstalledFootprint(),
    thresholdBasis: {
      memoryMetric: 'privateBytes',
      rationale:
        'Private bytes measure memory owned by MasterScript without double-counting shared system WebView2 pages.',
      electronIdlePrivateBytes: 388_407_296,
      electronLargePrivateBytes: 613_363_712,
      electronInstalledBytes: 409_043_384,
    },
  }
  await writeFile(
    path.join(outputDirectory, 'tauri-runtime-result.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  )

  const large = fixtureReports.find(
    (fixture) => fixture.fixture === 'large-200-page',
  )
  const failures: string[] = []
  if (idleProcessMemory.privateBytes > 388_407_296 * 0.5) {
    failures.push('Idle RAM reduction is below 50%')
  }
  if (
    !large ||
    large.processMemory.privateBytes > 613_363_712 * 0.65
  ) {
    failures.push('200-page editing RAM reduction is below 35%')
  }
  if (!report.installedTauri || report.installedTauri.installedBytes <= 0) {
    failures.push('Installed footprint could not be measured')
  } else if (report.installedTauri.installedBytes > 409_043_384 * 0.3) {
    failures.push('Installed footprint reduction is below 70%')
  }
  console.log(JSON.stringify(report, null, 2))
  if (failures.length > 0) {
    throw new Error(failures.join('; '))
  }
} finally {
  app.kill()
}
