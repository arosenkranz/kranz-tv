import { useEffect, useRef, useState } from 'react'
import { trackViewerCount } from '~/lib/datadog/rum'

export interface ViewerCountState {
  readonly count: number | null
  readonly isConnected: boolean
}

const MAX_RECONNECT_ATTEMPTS = 5
const BASE_RECONNECT_DELAY_MS = 1000

export function useViewerCount(channelId: string | null): ViewerCountState {
  const [count, setCount] = useState<number | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelRef = useRef(channelId)
  const prevChannelRef = useRef(channelId)

  // Keep channelRef in sync
  channelRef.current = channelId

  // Handle channel switches on an already-open socket
  useEffect(() => {
    if (
      channelId &&
      prevChannelRef.current &&
      channelId !== prevChannelRef.current &&
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      wsRef.current.send(JSON.stringify({ type: 'switch', channel: channelId }))
    }
    prevChannelRef.current = channelId
  }, [channelId])

  // Manage WebSocket connection lifecycle
  // Only runs on mount (creates socket) and unmount (closes socket)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!channelRef.current) return

    const buildUrl = (): string => {
      const isSecure = window.location.protocol === 'https:'
      const protocol = isSecure ? 'wss:' : 'ws:'
      return `${protocol}//${window.location.host}/_ws?channel=${channelRef.current}`
    }

    const handleOpen = () => {
      setIsConnected(true)
      reconnectAttempts.current = 0
    }

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(
          typeof event.data === 'string' ? event.data : '',
        ) as { type?: string; count?: number }

        if (data.type === 'viewer_count' && typeof data.count === 'number') {
          setCount(data.count)
          if (channelRef.current) {
            trackViewerCount(channelRef.current, data.count)
          }
        }
      } catch {
        // Ignore malformed messages
      }
    }

    const wireSocket = (socket: WebSocket) => {
      socket.addEventListener('open', handleOpen)
      socket.addEventListener('message', handleMessage)
      socket.addEventListener('close', () => {
        setIsConnected(false)

        if (channelRef.current && wsRef.current === socket) {
          if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
            const delay =
              BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts.current
            reconnectAttempts.current += 1
            reconnectTimer.current = setTimeout(() => {
              if (channelRef.current) {
                const newWs = new WebSocket(buildUrl())
                wsRef.current = newWs
                wireSocket(newWs)
              }
            }, delay)
          }
        }
      })
      socket.addEventListener('error', () => {
        // Error triggers close event
      })
    }

    const ws = new WebSocket(buildUrl())
    wsRef.current = ws
    wireSocket(ws)

    return () => {
      if (reconnectTimer.current !== null) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
      ws.close()
      wsRef.current = null
      setIsConnected(false)
    }
  }, [])

  // Handle channelId becoming null (disconnect)
  useEffect(() => {
    if (channelId === null) {
      if (reconnectTimer.current !== null) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setIsConnected(false)
      setCount(null)
    }
  }, [channelId])

  return { count, isConnected }
}
