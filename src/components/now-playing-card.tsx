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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(10px)',
        borderLeft: '3px solid #ff5500',
        borderRadius: 2,
        fontFamily: "'VT323', 'Courier New', monospace",
      }}
    >
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt={primaryLabel}
          aria-hidden="true"
          style={{ width: 48, height: 48, objectFit: 'cover', flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: '1.1rem',
            fontWeight: 600,
            color: '#fff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '0.04em',
          }}
        >
          {primaryLabel}
        </p>
        {secondaryLabel && (
          <p
            style={{
              margin: '2px 0 0',
              fontSize: '0.875rem',
              color: 'rgba(255,255,255,0.7)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              letterSpacing: '0.03em',
            }}
          >
            {secondaryLabel}
          </p>
        )}
        <div
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            marginTop: 8,
            height: 3,
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: '100%',
              background: '#ff5500',
              borderRadius: 2,
            }}
          />
        </div>
      </div>
      {deepLinkUrl && deepLinkLabel && (
        <a
          href={deepLinkUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flexShrink: 0,
            fontSize: '0.7rem',
            color: '#ff5500',
            textDecoration: 'none',
            letterSpacing: '0.08em',
            border: '1px solid #ff5500',
            padding: '4px 8px',
            whiteSpace: 'nowrap',
          }}
        >
          {deepLinkLabel}
        </a>
      )}
    </div>
  )
}
