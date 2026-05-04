import { ExternalLink } from 'lucide-react'
import { getSchedulePosition } from '~/lib/scheduling/algorithm'
import { formatChannelNumber } from '~/lib/format'
import { MONO_FONT } from '~/lib/theme'
import type {
  Channel,
  SchedulePosition,
  Video,
  VideoChannel,
} from '~/lib/scheduling/types'

interface MobileNowPlayingProps {
  readonly channel: Channel
  readonly position: SchedulePosition
}

const mono = { fontFamily: MONO_FONT }

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

export function MobileNowPlaying({ channel, position }: MobileNowPlayingProps) {
  const currentVideo = position.item as Video
  const progressPct =
    currentVideo.durationSeconds > 0
      ? Math.min(
          100,
          (position.seekSeconds / currentVideo.durationSeconds) * 100,
        )
      : 0

  const remainingSec = Math.max(
    0,
    currentVideo.durationSeconds - position.seekSeconds,
  )

  const nextPosition = getSchedulePosition(
    channel,
    new Date(position.slotEndTime.getTime() + 1000),
  )
  const nextVideo = nextPosition.item as Video

  const playlistId =
    channel.kind === 'video' ? (channel).playlistId : null

  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3"
      style={{ backgroundColor: '#0a0a0a' }}
    >
      {/* Channel */}
      <div>
        <div
          className="font-mono text-xs tracking-widest"
          style={{ color: 'rgba(57,255,20,0.5)', ...mono }}
        >
          {formatChannelNumber(channel.number)}
        </div>
        <div
          className="font-mono text-xl tracking-wider"
          style={{ color: '#39ff14', ...mono }}
        >
          {channel.name.toUpperCase()}
        </div>
      </div>

      {/* On Air */}
      <div>
        <div
          className="font-mono text-xs tracking-widest uppercase mb-0.5"
          style={{ color: 'rgba(255,165,0,0.5)', ...mono }}
        >
          On Air
        </div>
        <div
          className="font-mono text-lg leading-tight"
          style={{ color: '#ffa500', ...mono }}
        >
          {currentVideo.title}
        </div>
      </div>

      {/* Progress */}
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
      <div className="flex gap-4">
        <a
          href={`https://www.youtube.com/watch?v=${currentVideo.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-mono text-xs tracking-wider underline"
          style={{ color: 'rgba(255,255,255,0.4)', ...mono }}
        >
          <ExternalLink size={12} />
          YOUTUBE
        </a>
        {playlistId && (
          <a
            href={`https://www.youtube.com/playlist?list=${playlistId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-mono text-xs tracking-wider underline"
            style={{ color: 'rgba(255,255,255,0.4)', ...mono }}
          >
            <ExternalLink size={12} />
            PLAYLIST
          </a>
        )}
      </div>

      {/* Up Next */}
      <div
        className="border-t"
        style={{ borderColor: 'rgba(57,255,20,0.08)' }}
      />
      <div>
        <div
          className="font-mono text-xs tracking-widest uppercase mb-0.5"
          style={{ color: 'rgba(255,255,255,0.3)', ...mono }}
        >
          Up Next
        </div>
        <div
          className="font-mono text-base leading-tight"
          style={{ color: 'rgba(255,255,255,0.65)', ...mono }}
        >
          {nextVideo.title}
        </div>
        <div
          className="font-mono text-xs mt-0.5"
          style={{ color: 'rgba(255,255,255,0.3)', ...mono }}
        >
          {fmtHHMM(position.slotEndTime)} · {fmtTime(nextVideo.durationSeconds)}
        </div>
      </div>
    </div>
  )
}
