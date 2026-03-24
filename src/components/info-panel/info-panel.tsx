import { Play, ExternalLink } from 'lucide-react'
import { getSchedulePosition } from '~/lib/scheduling/algorithm'
import type { Channel, SchedulePosition } from '~/lib/scheduling/types'
import type { ChannelPreset } from '~/lib/channels/types'

const mono = { fontFamily: "'VT323', 'Courier New', monospace" }

export interface InfoPanelProps {
  channel: Channel | undefined
  preset: ChannelPreset | undefined
  position: SchedulePosition | null
  allPresets: ChannelPreset[]
  loadedChannels: Map<string, Channel>
  currentChannelId: string
  onChannelSelect: (id: string) => void
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function fmtHHMM(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayH = h % 12 === 0 ? 12 : h % 12
  return `${displayH}:${m} ${ampm}`
}

export function InfoPanel({
  channel,
  preset,
  position,
  allPresets,
  loadedChannels,
  currentChannelId,
  onChannelSelect,
}: InfoPanelProps) {
  const progressPct =
    position && position.video.durationSeconds > 0
      ? Math.min(
          100,
          (position.seekSeconds / position.video.durationSeconds) * 100,
        )
      : 0

  const remainingSec = position
    ? Math.max(0, position.video.durationSeconds - position.seekSeconds)
    : 0

  // Compute the next video by peeking 1 second past current slot end
  const nextPosition =
    channel && position
      ? getSchedulePosition(
          channel,
          new Date(position.slotEndTime.getTime() + 1000),
        )
      : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 border-b px-4 py-3"
        style={{ borderColor: 'rgba(57,255,20,0.15)' }}
      >
        <span
          className="flex items-center gap-2 font-mono text-sm tracking-widest uppercase"
          style={{ color: '#39ff14', ...mono }}
        >
          <Play size={14} />
          NOW PLAYING
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-retro px-4 py-4 flex flex-col gap-5">
        {position && channel ? (
          <>
            {/* Channel */}
            <div>
              <div
                className="font-mono text-sm tracking-widest"
                style={{ color: 'rgba(57,255,20,0.6)', ...mono }}
              >
                {preset
                  ? `CH ${String(preset.number).padStart(2, '0')}`
                  : channel.id}
              </div>
              <div
                className="font-mono text-2xl tracking-wider mt-0.5"
                style={{ color: '#39ff14', ...mono }}
              >
                {channel.name.toUpperCase()}
              </div>
            </div>

            {/* Now playing title */}
            <div>
              <div
                className="font-mono text-xs tracking-widest uppercase mb-1"
                style={{ color: 'rgba(255,165,0,0.6)', ...mono }}
              >
                On Air
              </div>
              <div
                className="font-mono text-xl leading-tight"
                style={{ color: '#ffa500', ...mono }}
              >
                {position.video.title}
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between mb-1">
                <span
                  className="font-mono text-xs"
                  style={{ color: 'rgba(255,255,255,0.4)', ...mono }}
                >
                  {fmtTime(position.seekSeconds)}
                </span>
                <span
                  className="font-mono text-xs"
                  style={{ color: 'rgba(255,255,255,0.4)', ...mono }}
                >
                  -{fmtTime(remainingSec)}
                </span>
              </div>
              <div
                className="h-1 w-full rounded-full overflow-hidden"
                style={{ backgroundColor: 'rgba(57,255,20,0.15)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: '#39ff14',
                    transition: 'width 1s linear',
                  }}
                />
              </div>
            </div>

            {/* Links */}
            <div className="flex flex-col gap-2">
              <a
                href={`https://www.youtube.com/watch?v=${position.video.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-mono text-sm tracking-wider underline"
                style={{ color: 'rgba(255,255,255,0.45)', ...mono }}
              >
                <ExternalLink size={14} />
                WATCH ON YOUTUBE
              </a>
              {channel.playlistId && (
                <a
                  href={`https://www.youtube.com/playlist?list=${channel.playlistId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-mono text-sm tracking-wider underline"
                  style={{ color: 'rgba(255,255,255,0.45)', ...mono }}
                >
                  <ExternalLink size={14} />
                  VIEW PLAYLIST
                </a>
              )}
            </div>

            {/* Up Next */}
            {nextPosition && (
              <>
                <div
                  className="border-t"
                  style={{ borderColor: 'rgba(57,255,20,0.1)' }}
                />
                <div>
                  <div
                    className="font-mono text-xs tracking-widest uppercase mb-1"
                    style={{ color: 'rgba(255,255,255,0.35)', ...mono }}
                  >
                    Up Next
                  </div>
                  <div
                    className="font-mono text-base leading-tight"
                    style={{ color: 'rgba(255,255,255,0.7)', ...mono }}
                  >
                    {nextPosition.video.title}
                  </div>
                  <div
                    className="font-mono text-xs mt-1"
                    style={{ color: 'rgba(255,255,255,0.35)', ...mono }}
                  >
                    {fmtHHMM(position.slotEndTime)} · {fmtTime(nextPosition.video.durationSeconds)}
                  </div>
                </div>
              </>
            )}

            {/* Divider */}
            <div
              className="border-t"
              style={{ borderColor: 'rgba(57,255,20,0.1)' }}
            />

            {/* Mini guide */}
            <div>
              <div
                className="font-mono text-xs tracking-widest uppercase mb-2"
                style={{ color: 'rgba(255,165,0,0.6)', ...mono }}
              >
                Channels
              </div>
              <div className="flex flex-col gap-0.5">
                {allPresets.map((p) => {
                  const ch = loadedChannels.get(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onChannelSelect(p.id)}
                      className="flex items-center gap-2 rounded px-2 py-1 text-left transition-colors w-full"
                      style={{
                        backgroundColor:
                          p.id === currentChannelId
                            ? 'rgba(57,255,20,0.1)'
                            : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (p.id !== currentChannelId)
                          e.currentTarget.style.backgroundColor =
                            'rgba(57,255,20,0.06)'
                      }}
                      onMouseLeave={(e) => {
                        if (p.id !== currentChannelId)
                          e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      <span
                        className="font-mono text-sm shrink-0"
                        style={{
                          color:
                            p.id === currentChannelId
                              ? '#39ff14'
                              : 'rgba(57,255,20,0.45)',
                          minWidth: '40px',
                          ...mono,
                        }}
                      >
                        CH{String(p.number).padStart(2, '0')}
                      </span>
                      <span
                        className="font-mono text-sm truncate"
                        style={{
                          color:
                            p.id === currentChannelId
                              ? 'rgba(255,255,255,0.9)'
                              : 'rgba(255,255,255,0.5)',
                          ...mono,
                        }}
                      >
                        {ch?.name ?? p.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        ) : (
          <div
            className="font-mono text-base tracking-wider animate-pulse"
            style={{ color: 'rgba(57,255,20,0.4)', ...mono }}
          >
            SELECT A CHANNEL
          </div>
        )}
      </div>
    </div>
  )
}
