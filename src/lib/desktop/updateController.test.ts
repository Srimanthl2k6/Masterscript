import { describe, expect, it, vi } from 'vitest'
import { createUpdateController } from './updateController'

const fixture = () => {
  const payload = { version: '0.7.0', download: vi.fn(async () => {}), install: vi.fn(async () => {}), close: vi.fn(async () => {}) }
  const options = { check: vi.fn(async () => payload), managed: vi.fn(async () => false), relaunch: vi.fn(async () => {}), status: vi.fn(),
    safety: { canInstall: vi.fn(() => true), preserve: vi.fn(async () => true), freeze: vi.fn() } }
  return { payload, options, controller: createUpdateController(options) }
}
describe('safe signed updater lifecycle', () => {
  it('downloads first, freezes, preserves, installs, then relaunches', async () => {
    const { payload, options, controller } = fixture()
    await controller.tick()
    expect(payload.download).toHaveBeenCalledOnce()
    expect(options.safety.freeze.mock.calls).toEqual([[true], [false]])
    expect(options.safety.preserve.mock.invocationCallOrder[0]).toBeLessThan(payload.install.mock.invocationCallOrder[0])
    expect(payload.install.mock.invocationCallOrder[0]).toBeLessThan(options.relaunch.mock.invocationCallOrder[0])
  })
  it('never installs when persistence fails, and retries without redownloading', async () => {
    const { payload, options, controller } = fixture()
    options.safety.preserve.mockResolvedValueOnce(false)
    await controller.tick()
    expect(payload.install).not.toHaveBeenCalled()
    await controller.tick()
    expect(payload.download).toHaveBeenCalledOnce()
    expect(payload.install).toHaveBeenCalledOnce()
  })
  it('defers active work and rechecks safety after asynchronous persistence', async () => {
    const { payload, options, controller } = fixture()
    options.safety.canInstall.mockReturnValueOnce(false)
    await controller.tick()
    expect(payload.download).toHaveBeenCalledOnce()
    expect(payload.install).not.toHaveBeenCalled()
    options.safety.canInstall.mockReturnValueOnce(true).mockReturnValueOnce(false)
    await controller.tick()
    expect(payload.install).not.toHaveBeenCalled()
  })
  it('only announces updates for package-managed installations', async () => {
    const { payload, options, controller } = fixture()
    options.managed.mockResolvedValue(true)
    await controller.tick()
    expect(payload.download).not.toHaveBeenCalled()
    expect(payload.install).not.toHaveBeenCalled()
    expect(options.status).toHaveBeenCalledWith(expect.stringContaining('package manager'))
  })
  it('backs off on network/signature failures and cancels safely', async () => {
    const { payload, options, controller } = fixture()
    payload.download.mockRejectedValueOnce(new Error('Invalid signature'))
    await controller.tick()
    expect(payload.install).not.toHaveBeenCalled()
    expect(controller.retryDelay).toBe(120000)
    controller.stop()
    await controller.tick()
    expect(options.check).toHaveBeenCalledOnce()
  })
})
