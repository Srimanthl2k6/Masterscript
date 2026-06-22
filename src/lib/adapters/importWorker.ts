import { validateImportedProjectResult } from './importLimits'
import type { ImportConversionRequest } from './importWorkerClient'
import type { ScriptProjectAdapterResult } from './types'

interface ImportWorkerResponse {
  ok: boolean
  result?: ScriptProjectAdapterResult
  error?: string
}

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<ImportConversionRequest>) => void) | null
  postMessage(message: ImportWorkerResponse): void
}

workerScope.onmessage = async (event) => {
  try {
    let result: ScriptProjectAdapterResult
    if (event.data.kind === 'fountain') {
      const { importFountainProject } = await import('./fountain')
      result = importFountainProject(event.data.content)
    } else if (event.data.kind === 'fdx') {
      const { importFdxProject } = await import('./fdx')
      result = importFdxProject(event.data.content)
    } else {
      const { importDocxProject } = await import('./docx')
      result = await importDocxProject(event.data.content)
    }
    workerScope.postMessage({
      ok: true,
      result: validateImportedProjectResult(result),
    })
  } catch (error) {
    workerScope.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : 'Import conversion failed.',
    })
  }
}
