import type { ScriptProjectAdapterResult } from './types'
import {
  validateDocxImportSize,
  validateTextImportSize,
} from './importLimits'

export type ImportConversionRequest =
  | { kind: 'fountain'; content: string }
  | { kind: 'fdx'; content: string }
  | { kind: 'docx'; content: ArrayBuffer }

interface ImportWorkerResponse {
  ok: boolean
  result?: ScriptProjectAdapterResult
  error?: string
}

interface ImportWorkerLike {
  onmessage: ((event: MessageEvent<ImportWorkerResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage(message: ImportConversionRequest, transfer?: Transferable[]): void
  terminate(): void
}

interface ImportWorkerOptions {
  timeoutMs?: number
  workerFactory?: () => ImportWorkerLike
}

const createImportWorker = (): ImportWorkerLike =>
  new Worker(new URL('./importWorker.ts', import.meta.url), { type: 'module' })

export const runImportConversion = (
  request: ImportConversionRequest,
  {
    timeoutMs = 15_000,
    workerFactory = createImportWorker,
  }: ImportWorkerOptions = {},
): Promise<ScriptProjectAdapterResult> => {
  if (request.kind === 'docx') {
    validateDocxImportSize(request.content)
  } else {
    validateTextImportSize(request.content)
  }

  return new Promise((resolve, reject) => {
    const worker = workerFactory()
    const timeout = globalThis.setTimeout(() => {
      worker.terminate()
      reject(new Error('Import conversion timed out after 15 seconds.'))
    }, timeoutMs)

    const finish = () => {
      globalThis.clearTimeout(timeout)
      worker.terminate()
    }

    worker.onmessage = (event) => {
      finish()
      if (event.data.ok && event.data.result) {
        resolve(event.data.result)
      } else {
        reject(new Error(event.data.error ?? 'Import conversion failed.'))
      }
    }
    worker.onerror = (event) => {
      finish()
      reject(new Error(event.message || 'Import worker failed.'))
    }

    if (request.kind === 'docx') {
      worker.postMessage(request, [request.content])
    } else {
      worker.postMessage(request)
    }
  })
}
