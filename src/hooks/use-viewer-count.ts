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

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!channelId) {
      setCount(null)
      setIsConnected(false)
      return
    }

    reconnectAttempts.current = 0

    const buildUrl = (): string => {
      const isSecure = window.location.protocol === 'https:'
      const protocol = isSecure ? 'wss:' : 'ws:'
      return `${protocol}//${window.location.host}/_ws?channel=${channelId}`
    }

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(
          typeof event.data === 'string' ? event.data : '',
        ) as { type?: string; count?: number }

        if (data.type === 'viewer_count' && typeof data.count === 'number') {
          setCount(data.count)
          trackViewerCount(channelId, data.count)
        }
      } catch {
        // Ignore malformed messages
      }
    }

    const wireSocket = (socket: WebSocket) => {
      socket.addEventListener('open', () => {
        setIsConnected(true)
        reconnectAttempts.current = 0
      })
      socket.addEventListener('message', handleMessage)
      socket.addEventListener('close', () => {
        setIsConnected(false)

        if (wsRef.current === socket) {
          if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
            const delay =
              BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts.current
            reconnectAttempts.current += 1
            reconnectTimer.current = setTimeout(() => {
              const newWs = new WebSocket(buildUrl())
              wsRef.current = newWs
              wireSocket(newWs)
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
  }, [channelId])

  return { count, isConnected }
}
