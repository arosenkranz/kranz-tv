const MONO = "'VT323', 'Courier New', monospace"
const GREEN = '#39ff14'

export interface ToastProps {
  visible: boolean
  message: string
  detail?: string
}

export function Toast({ visible, message, detail }: ToastProps) {
  if (!visible && !message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'fixed',
        bottom: '5rem',
        left: '1.5rem',
        zIndex: 9998,
        opacity: visible ? 1 : 0,
        transition: 'opacity 300ms ease',
        pointerEvents: 'none',
        fontFamily: MONO,
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0,0,0,0.82)',
          border: '1px solid rgba(57,255,20,0.4)',
          borderRadius: '2px',
          padding: '0.5rem 1rem',
          boxShadow: '0 0 12px rgba(57,255,20,0.15)',
        }}
      >
        <p
          style={{
            color: GREEN,
            fontFamily: MONO,
            fontSize: '1.5rem',
            letterSpacing: '0.15em',
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          {message}
        </p>
        {detail !== undefined && (
          <p
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontFamily: MONO,
              fontSize: '0.75rem',
              letterSpacing: '0.05em',
              marginTop: '0.2rem',
              margin: '0.2rem 0 0',
              wordBreak: 'break-all',
            }}
          >
            {detail}
          </p>
        )}
      </div>
    </div>
  )
}
