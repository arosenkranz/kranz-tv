import { useState, useEffect } from 'react'
import { MonitorPlay } from 'lucide-react'

export interface EpgOverlayHeaderProps {
  mode?: 'overlay' | 'inline'
}

function formatClock(ms: number): string {
  const date = new Date(ms)
  const hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 === 0 ? 12 : hours % 12
  return `${displayHours}:${minutes}:${seconds} ${ampm}`
}

export function EpgOverlayHeader({ mode = 'overlay' }: EpgOverlayHeaderProps) {
  const [tickMs, setTickMs] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setTickMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="shrink-0 flex items-center justify-between px-4 py-3 border-b"
      style={{ borderColor: 'rgba(255,165,0,0.3)', backgroundColor: '#0d0d0d' }}
    >
      <span
        className="flex items-center gap-2 font-mono text-xl tracking-widest uppercase"
        style={{ color: '#ffa500', fontFamily: "'VT323', 'Courier New', monospace" }}
      >
        <MonitorPlay size={16} />
        TV GUIDE
      </span>

      <span
        className="font-mono text-lg tracking-widest"
        style={{ color: '#39ff14', fontFamily: "'VT323', 'Courier New', monospace" }}
      >
        {formatClock(tickMs)}
      </span>

      {mode === 'overlay' && (
        <span
          className="font-mono text-base tracking-widest"
          style={{ color: 'rgba(255,255,255,0.4)', fontFamily: "'VT323', 'Courier New', monospace" }}
        >
          [ESC] CLOSE
        </span>
      )}
    </div>
  )
}
