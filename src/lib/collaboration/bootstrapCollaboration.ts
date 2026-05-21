import * as Y from 'yjs'
import { hasRenderableProject } from './projectYjs'

interface WaitForRenderableProjectOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

export const COLLABORATION_BOOTSTRAP_TIMEOUT_MESSAGE =
  'No collaborator is currently online for this room'

export const COLLABORATION_BOOTSTRAP_CANCELLED_MESSAGE =
  'Collaboration join cancelled'

export const waitForRenderableProject = (
  ydoc: Y.Doc,
  options: WaitForRenderableProjectOptions = {},
): Promise<void> =>
  new Promise((resolve, reject) => {
    const timeoutMs = options.timeoutMs ?? 30_000
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null

    const cleanup = () => {
      ydoc.off('update', onUpdate)
      options.signal?.removeEventListener('abort', onAbort)
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId)
      }
    }

    const finish = () => {
      cleanup()
      resolve()
    }

    const fail = (message: string) => {
      cleanup()
      reject(new Error(message))
    }

    const check = () => {
      if (hasRenderableProject(ydoc)) {
        finish()
      }
    }

    function onUpdate() {
      check()
    }

    function onAbort() {
      fail(COLLABORATION_BOOTSTRAP_CANCELLED_MESSAGE)
    }

    if (options.signal?.aborted) {
      fail(COLLABORATION_BOOTSTRAP_CANCELLED_MESSAGE)
      return
    }

    ydoc.on('update', onUpdate)
    options.signal?.addEventListener('abort', onAbort, { once: true })
    timeoutId = globalThis.setTimeout(
      () => fail(COLLABORATION_BOOTSTRAP_TIMEOUT_MESSAGE),
      timeoutMs,
    )
    check()
  })
