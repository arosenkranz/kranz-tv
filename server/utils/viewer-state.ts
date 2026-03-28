// Shared viewer tracking state.
// Both the WebSocket handler and REST endpoint import this module,
// sharing the same in-memory Maps within a single Durable Object isolate.

const channelPeers = new Map<string, Set<string>>()
const peerChannel = new Map<string, string>()

export function getCount(channelId: string): number {
  return channelPeers.get(channelId)?.size ?? 0
}

export function getChannelCounts(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const [channelId, peers] of channelPeers) {
    counts[channelId] = peers.size
  }
  return counts
}

export function addPeerToChannel(peerId: string, channelId: string): void {
  if (!channelPeers.has(channelId)) {
    channelPeers.set(channelId, new Set())
  }
  channelPeers.get(channelId)!.add(peerId)
  peerChannel.set(peerId, channelId)
}

export function removePeerFromChannel(peerId: string): string | undefined {
  const channelId = peerChannel.get(peerId)
  if (channelId === undefined) return undefined

  const peers = channelPeers.get(channelId)
  if (peers) {
    peers.delete(peerId)
    if (peers.size === 0) channelPeers.delete(channelId)
  }
  peerChannel.delete(peerId)
  return channelId
}
