import React from 'react'

interface Props {
  primaryLabel: string
  secondaryLabel?: string
  thumbnailUrl?: string
  elapsedSeconds: number
  durationSeconds: number
  deepLinkUrl?: string
  deepLinkLabel?: string
}

export function NowPlayingCard({
  primaryLabel,
  secondaryLabel,
  thumbnailUrl,
  elapsedSeconds,
  durationSeconds,
  deepLinkUrl,
  deepLinkLabel,
}: Props) {
  const progress =
    durationSeconds > 0 ? Math.min(elapsedSeconds / durationSeconds, 1) : 0

  return (
    <div className="now-playing-card">
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt={primaryLabel}
          className="now-playing-card__artwork"
          aria-hidden="true"
        />
      )}
      <div className="now-playing-card__info">
        <p className="now-playing-card__title">{primaryLabel}</p>
        {secondaryLabel && (
          <p className="now-playing-card__artist">{secondaryLabel}</p>
        )}
        <div
          className="now-playing-card__progress"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="now-playing-card__progress-fill"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
      {deepLinkUrl && deepLinkLabel && (
        <a
          href={deepLinkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="now-playing-card__deep-link"
        >
          {deepLinkLabel}
        </a>
      )}
    </div>
  )
}
