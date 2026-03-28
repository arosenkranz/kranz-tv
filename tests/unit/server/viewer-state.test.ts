import { describe, it, expect, beforeEach } from 'vitest'

// Import the viewer state module fresh for each test
// We need to re-import to reset the internal Maps
let viewerState: typeof import('../../../server/utils/viewer-state')

describe('viewer-state', () => {
  beforeEach(async () => {
    // Dynamic import with cache-busting to get fresh module state
    // Note: Vitest resets modules between files but not between tests in the same file
    // We rely on the cleanup in each test to maintain isolation
    viewerState = await import('../../../server/utils/viewer-state')
  })

  describe('addPeerToChannel + getCount', () => {
    it('starts with zero viewers', () => {
      expect(viewerState.getCount('empty-channel')).toBe(0)
    })

    it('increments count when peer joins', () => {
      viewerState.addPeerToChannel('peer-1', 'skate')
      expect(viewerState.getCount('skate')).toBe(1)
    })

    it('tracks multiple peers on same channel', () => {
      viewerState.addPeerToChannel('peer-1', 'skate')
      viewerState.addPeerToChannel('peer-2', 'skate')
      viewerState.addPeerToChannel('peer-3', 'skate')
      expect(viewerState.getCount('skate')).toBe(3)

      // Clean up
      viewerState.removePeerFromChannel('peer-1')
      viewerState.removePeerFromChannel('peer-2')
      viewerState.removePeerFromChannel('peer-3')
    })

    it('tracks peers across different channels independently', () => {
      viewerState.addPeerToChannel('peer-1', 'skate')
      viewerState.addPeerToChannel('peer-2', 'music')
      expect(viewerState.getCount('skate')).toBe(1)
      expect(viewerState.getCount('music')).toBe(1)

      // Clean up
      viewerState.removePeerFromChannel('peer-1')
      viewerState.removePeerFromChannel('peer-2')
    })
  })

  describe('removePeerFromChannel', () => {
    it('returns the channel the peer was on', () => {
      viewerState.addPeerToChannel('peer-1', 'skate')
      const channelId = viewerState.removePeerFromChannel('peer-1')
      expect(channelId).toBe('skate')
    })

    it('returns undefined for unknown peer', () => {
      const channelId = viewerState.removePeerFromChannel('unknown-peer')
      expect(channelId).toBeUndefined()
    })

    it('decrements count when peer leaves', () => {
      viewerState.addPeerToChannel('peer-1', 'skate')
      viewerState.addPeerToChannel('peer-2', 'skate')
      expect(viewerState.getCount('skate')).toBe(2)

      viewerState.removePeerFromChannel('peer-1')
      expect(viewerState.getCount('skate')).toBe(1)

      viewerState.removePeerFromChannel('peer-2')
      expect(viewerState.getCount('skate')).toBe(0)
    })
  })

  describe('getChannelCounts', () => {
    it('returns empty object when no viewers', () => {
      expect(viewerState.getChannelCounts()).toEqual({})
    })

    it('returns counts for all active channels', () => {
      viewerState.addPeerToChannel('peer-1', 'skate')
      viewerState.addPeerToChannel('peer-2', 'skate')
      viewerState.addPeerToChannel('peer-3', 'music')

      const counts = viewerState.getChannelCounts()
      expect(counts).toEqual({ skate: 2, music: 1 })

      // Clean up
      viewerState.removePeerFromChannel('peer-1')
      viewerState.removePeerFromChannel('peer-2')
      viewerState.removePeerFromChannel('peer-3')
    })

    it('removes channel from counts when last peer leaves', () => {
      viewerState.addPeerToChannel('peer-1', 'skate')
      viewerState.removePeerFromChannel('peer-1')

      const counts = viewerState.getChannelCounts()
      expect(counts).toEqual({})
    })
  })

  describe('channel switching', () => {
    it('supports moving a peer between channels', () => {
      viewerState.addPeerToChannel('peer-1', 'skate')
      expect(viewerState.getCount('skate')).toBe(1)

      // Simulate channel switch: remove from old, add to new
      viewerState.removePeerFromChannel('peer-1')
      viewerState.addPeerToChannel('peer-1', 'music')

      expect(viewerState.getCount('skate')).toBe(0)
      expect(viewerState.getCount('music')).toBe(1)

      // Clean up
      viewerState.removePeerFromChannel('peer-1')
    })
  })
})
