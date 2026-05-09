import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  publishShare,
  resolveShare,
  revokeShare,
  setShareTransport,
} from '~/lib/shares/share-client'
import type { ShareTransport } from '~/lib/shares/share-client'
import type { Channel } from '~/lib/scheduling/types'

const VIDEO_CHANNEL: Channel = {
  kind: 'video',
  id: 'test',
  number: 99,
  name: 'Test Channel',
  playlistId: 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
  videos: [],
  totalDurationSeconds: 0,
}

function makeMockTransport(
  overrides: Partial<ShareTransport> = {},
): ShareTransport {
  return {
    publish: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        shareId: 'ABCDEFGH',
        shareUrl: 'https://kranz.tv/s/ABCDEFGH',
        isNew: true,
      },
    }),
    resolve: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        record: {
          shareId: 'ABCDEFGH',
          kind: 'video',
          sourceUrl: 'https://www.youtube.com/playlist?list=PLxxx',
          name: 'Test',
          description: null,
          createdAt: 0,
          revokedAt: null,
        },
      },
    }),
    revoke: vi.fn().mockResolvedValue({
      ok: true,
      value: { ok: true, revokedAt: 12345 },
    }),
    ...overrides,
  }
}

describe('share-client', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  describe('publishShare', () => {
    it('forwards channel + credential to the transport and returns the result', async () => {
      const transport = makeMockTransport()
      setShareTransport(transport)

      const result = await publishShare(VIDEO_CHANNEL)
      expect(result.ok).toBe(true)
      expect(transport.publish).toHaveBeenCalledTimes(1)
      const call = vi.mocked(transport.publish).mock.calls[0][0]
      expect(call.channel.kind).toBe('video')
      expect(call.channel.name).toBe('Test Channel')
      expect(call.credential).toMatch(/^[A-Za-z0-9_-]{43}$/)
    })

    it('builds a YouTube playlist URL from the channel.playlistId', async () => {
      const transport = makeMockTransport()
      setShareTransport(transport)

      await publishShare(VIDEO_CHANNEL)
      const call = vi.mocked(transport.publish).mock.calls[0][0]
      expect(call.channel.sourceUrl).toBe(
        'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
      )
    })

    it('passes through the music sourceUrl unchanged for music channels', async () => {
      const transport = makeMockTransport()
      setShareTransport(transport)

      await publishShare({
        kind: 'music',
        id: 'm1',
        number: 99,
        name: 'Music Channel',
        source: 'soundcloud',
        sourceUrl: 'https://soundcloud.com/x/sets/y',
        totalDurationSeconds: 0,
        trackCount: 0,
      })
      const call = vi.mocked(transport.publish).mock.calls[0][0]
      expect(call.channel.sourceUrl).toBe('https://soundcloud.com/x/sets/y')
    })

    it('surfaces transport rejections as kv_unavailable', async () => {
      const transport = makeMockTransport({
        publish: vi.fn().mockRejectedValue(new Error('boom')),
      })
      setShareTransport(transport)

      const result = await publishShare(VIDEO_CHANNEL)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('kv_unavailable')
    })

    it('returns the transport error envelope unchanged on a typed failure', async () => {
      const transport = makeMockTransport({
        publish: vi.fn().mockResolvedValue({
          ok: false,
          error: 'rate_limited',
          retryAfterMs: 60_000,
        }),
      })
      setShareTransport(transport)

      const result = await publishShare(VIDEO_CHANNEL)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('rate_limited')
      expect(result.retryAfterMs).toBe(60_000)
    })
  })

  describe('resolveShare', () => {
    it('forwards the shareId and returns the record', async () => {
      const transport = makeMockTransport()
      setShareTransport(transport)

      const result = await resolveShare('ABCDEFGH')
      expect(result.ok).toBe(true)
      expect(transport.resolve).toHaveBeenCalledWith({ shareId: 'ABCDEFGH' })
    })

    it('does NOT read the local credential', async () => {
      const transport = makeMockTransport()
      setShareTransport(transport)
      window.localStorage.clear()

      await resolveShare('ABCDEFGH')

      // No credential created — resolve is unauthenticated.
      expect(
        window.localStorage.getItem('kranz.tv.sharer.credential.v1'),
      ).toBeNull()
    })

    it('surfaces transport rejections as kv_unavailable', async () => {
      const transport = makeMockTransport({
        resolve: vi.fn().mockRejectedValue(new Error('boom')),
      })
      setShareTransport(transport)

      const result = await resolveShare('ABCDEFGH')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('kv_unavailable')
    })
  })

  describe('revokeShare', () => {
    it('forwards shareId + credential and returns the result', async () => {
      const transport = makeMockTransport()
      setShareTransport(transport)

      const result = await revokeShare('ABCDEFGH')
      expect(result.ok).toBe(true)
      const call = vi.mocked(transport.revoke).mock.calls[0][0]
      expect(call.shareId).toBe('ABCDEFGH')
      expect(call.credential).toMatch(/^[A-Za-z0-9_-]{43}$/)
    })

    it('surfaces transport rejections as kv_unavailable', async () => {
      const transport = makeMockTransport({
        revoke: vi.fn().mockRejectedValue(new Error('boom')),
      })
      setShareTransport(transport)

      const result = await revokeShare('ABCDEFGH')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('kv_unavailable')
    })
  })
})
