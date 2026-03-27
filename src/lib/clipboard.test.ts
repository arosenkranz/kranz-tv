import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { copyToClipboard } from './clipboard'

// jsdom does not provide document.execCommand — stub it so vi.spyOn can attach
if (typeof document.execCommand !== 'function') {
  document.execCommand = () => false
}

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('navigator.clipboard path', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
      })
    })

    it('returns true on success', async () => {
      const result = await copyToClipboard('https://kranz.tv/channel/nature')
      expect(result).toBe(true)
    })

    it('calls writeText with the provided text', async () => {
      await copyToClipboard('https://kranz.tv/channel/nature')
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://kranz.tv/channel/nature',
      )
    })

    it('falls through to execCommand when writeText rejects', async () => {
      vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
        new Error('Not allowed'),
      )
      const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true)
      const result = await copyToClipboard('https://kranz.tv/channel/nature')
      expect(result).toBe(true)
      expect(execSpy).toHaveBeenCalledWith('copy')
    })
  })

  describe('execCommand fallback path', () => {
    beforeEach(() => {
      // Remove clipboard API to force fallback
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
      })
    })

    it('returns true when execCommand succeeds', async () => {
      const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true)
      const result = await copyToClipboard('https://kranz.tv/channel/skate')
      expect(result).toBe(true)
      expect(execSpy).toHaveBeenCalledWith('copy')
    })

    it('returns false when execCommand returns false', async () => {
      vi.spyOn(document, 'execCommand').mockReturnValue(false)
      const result = await copyToClipboard('https://kranz.tv/channel/skate')
      expect(result).toBe(false)
    })

    it('appends and removes the temporary textarea', async () => {
      const appendSpy = vi.spyOn(document.body, 'appendChild')
      const removeSpy = vi.spyOn(document.body, 'removeChild')
      vi.spyOn(document, 'execCommand').mockReturnValue(true)

      await copyToClipboard('test text')

      expect(appendSpy).toHaveBeenCalledOnce()
      expect(removeSpy).toHaveBeenCalledOnce()
    })

    it('still removes textarea when execCommand throws', async () => {
      const removeSpy = vi.spyOn(document.body, 'removeChild')
      vi.spyOn(document, 'execCommand').mockImplementation(() => {
        throw new Error('execCommand failed')
      })

      const result = await copyToClipboard('test text')

      expect(result).toBe(false)
      expect(removeSpy).toHaveBeenCalledOnce()
    })
  })
})
