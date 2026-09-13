export interface UpdatePayload {
  version: string
  download(): Promise<void>
  install(): Promise<void>
  close(): Promise<void>
}
export interface UpdateSafety {
  canInstall(): boolean
  preserve(): Promise<boolean>
  freeze(frozen: boolean): void
}
export const createUpdateController = (options: {
  check(): Promise<UpdatePayload | null>
  managed(): Promise<boolean>
  safety: UpdateSafety
  relaunch(): Promise<void>
  status(message: string): void
}) => {
  let busy = false
  let pending: UpdatePayload | null = null
  let downloaded = false
  let failures = 0
  let stopped = false
  return {
    get retryDelay() { return pending || failures ? Math.min(6 * 60 * 60_000, 60_000 * 2 ** failures) : 6 * 60 * 60_000 },
    stop() { stopped = true; if (pending && !busy) void pending.close().catch(() => {}) },
    async tick(): Promise<void> {
      if (busy || stopped) return
      busy = true
      let frozen = false
      try {
        const managed = await options.managed()
        pending ??= await options.check()
        if (!pending) { failures = 0; return }
        if (stopped) return
        if (managed) {
          options.status(`MasterScript ${pending.version} is available. Update through your package manager.`)
          await pending.close(); pending = null; failures = 0; return
        }
        if (!downloaded) {
          options.status(`Downloading MasterScript ${pending.version}`)
          await pending.download()
          downloaded = true
        }
        if (stopped || !options.safety.canInstall()) {
          options.status(`MasterScript ${pending.version} is downloaded. It will install when the workspace is idle.`)
          return
        }
        // Freeze first; then persist and recheck. Windows installers may exit the app.
        options.safety.freeze(true); frozen = true
        if (!await options.safety.preserve() || stopped || !options.safety.canInstall()) {
          options.status('Update waiting until all screenplay changes are saved.')
          return
        }
        options.status(`Installing MasterScript ${pending.version}`)
        await pending.install()
        await options.relaunch()
        await pending.close(); pending = null; downloaded = false; failures = 0
      } catch {
        failures += 1
        options.status('Update unavailable; your project is safe. MasterScript will retry.')
      } finally {
        if (stopped && pending) { await pending.close().catch(() => {}); pending = null }
        if (frozen) options.safety.freeze(false)
        busy = false
      }
    },
  }
}
