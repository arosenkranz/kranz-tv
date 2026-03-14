export interface TimeHeaderProps {
  windowStart: Date
  windowEnd: Date
  nowMs: number
}

function formatTimeLabel(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 === 0 ? 12 : hours % 12
  const displayMinutes = minutes.toString().padStart(2, '0')
  return `${displayHours}:${displayMinutes} ${ampm}`
}

function buildTimeLabels(windowStart: Date, windowEnd: Date): Date[] {
  const startMs = windowStart.getTime()
  const endMs = windowEnd.getTime()
  const intervalMs = 30 * 60 * 1000

  // Snap to the next 30-minute mark at or after windowStart
  const firstLabelMs = Math.ceil(startMs / intervalMs) * intervalMs

  const labels: Date[] = []
  let cursor = firstLabelMs
  while (cursor <= endMs) {
    labels.push(new Date(cursor))
    cursor += intervalMs
  }
  return labels
}

function toPercent(timeMs: number, startMs: number, endMs: number): number {
  return ((timeMs - startMs) / (endMs - startMs)) * 100
}

export function TimeHeader({ windowStart, windowEnd, nowMs }: TimeHeaderProps) {
  const startMs = windowStart.getTime()
  const endMs = windowEnd.getTime()
  const labels = buildTimeLabels(windowStart, windowEnd)
  const nowPercent = toPercent(nowMs, startMs, endMs)

  return (
    <div className="relative h-8 bg-zinc-900 border-b border-zinc-700 select-none overflow-hidden">
      {/* Channel label column spacer */}
      <div className="absolute left-0 top-0 w-40 h-full bg-zinc-900 z-10 border-r border-zinc-700" />

      {/* Time labels */}
      <div className="absolute inset-0 left-40">
        {labels.map((label) => {
          const pct = toPercent(label.getTime(), startMs, endMs)
          if (pct < 0 || pct > 100) return null
          return (
            <span
              key={label.getTime()}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-xs text-zinc-300 font-mono whitespace-nowrap"
              style={{ left: `${pct}%` }}
            >
              {formatTimeLabel(label)}
            </span>
          )
        })}
      </div>

      {/* Now indicator */}
      {nowPercent >= 0 && nowPercent <= 100 && (
        <div
          className="absolute top-0 bottom-0 w-px bg-amber-400 z-20"
          style={{
            left: `calc(${nowPercent}% * ((100% - 10rem) / 100%) + 10rem)`,
            boxShadow: '0 0 6px rgba(255,165,0,0.4)',
          }}
          aria-label="Current time"
        />
      )}
    </div>
  )
}
