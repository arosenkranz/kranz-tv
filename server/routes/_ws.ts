import { defineWebSocketHandler } from 'nitro'
import {
  addPeerToChannel,
  getCount,
  removePeerFromChannel,
} from '../utils/viewer-state'

function broadcastCount(
  peer: { publish: (topic: string, data: unknown) => void },
  channelId: string,
): void {
  const count = getCount(channelId)
  const payload = { type: 'viewer_count', channel: channelId, count }
  peer.publish(`viewers:${channelId}`, payload)
}

export default defineWebSocketHandler({
  open(peer) {
    const url = new URL(peer.url ?? '', 'http://localhost')
    const channelId = url.searchParams.get('channel')

    if (!channelId) {
      peer.send({ type: 'error', message: 'Missing ?channel= parameter' })
      return
    }

    addPeerToChannel(peer.id, channelId)
    peer.subscribe(`viewers:${channelId}`)

    // Send current count to the new peer, broadcast to everyone else
    const count = getCount(channelId)
    peer.send({ type: 'viewer_count', channel: channelId, count })
    broadcastCount(peer, channelId)
  },

  message(peer, message) {
    const text = message.text()
    let parsed: { type?: string; channel?: string }
    try {
      parsed = JSON.parse(text) as { type?: string; channel?: string }
    } catch {
      return
    }

    if (parsed.type === 'switch' && parsed.channel) {
      const oldChannel = removePeerFromChannel(peer.id)

      if (oldChannel) {
        peer.unsubscribe(`viewers:${oldChannel}`)
        broadcastCount(peer, oldChannel)
      }

      addPeerToChannel(peer.id, parsed.channel)
      peer.subscribe(`viewers:${parsed.channel}`)

      const count = getCount(parsed.channel)
      peer.send({ type: 'viewer_count', channel: parsed.channel, count })
      broadcastCount(peer, parsed.channel)
    }

    if (parsed.type === 'ping') {
      peer.send({ type: 'pong' })
    }
  },

  close(peer) {
    const channelId = removePeerFromChannel(peer.id)

    if (channelId) {
      broadcastCount(peer, channelId)
    }
  },
})
