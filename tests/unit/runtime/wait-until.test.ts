import { describe, it, expect, vi } from 'vitest'
import { waitUntil } from '~/lib/runtime/wait-until'

/**
 * The default resolution (what tsc and Vitest see) must be the Node
 * adapter: non-blocking, never importing cloudflare:workers.
 */
describe('waitUntil (node adapter)', () => {
  it('returns without awaiting the promise', async () => {
    let settled = false
    const promise = new Promise<void>((resolve) =>
      setTimeout(() => {
        settled = true
        resolve()
      }, 10),
    )

    waitUntil(promise)
    expect(settled).toBe(false) // fire-and-forget, not synchronous execution

    await promise
    expect(settled).toBe(true)
  })

  it('logs and swallows rejections instead of leaving them unhandled', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const rejection = Promise.reject(new Error('background work exploded'))

    waitUntil(rejection)
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalledOnce())
    expect(errorSpy.mock.calls[0][1]).toBeInstanceOf(Error)
    errorSpy.mockRestore()
  })
})
