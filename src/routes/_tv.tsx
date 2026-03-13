import { createContext, useContext, useState } from 'react'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export interface TvLayoutContextValue {
  guideVisible: boolean
  toggleGuide: () => void
}

export const TvLayoutContext = createContext<TvLayoutContextValue>({
  guideVisible: true,
  toggleGuide: () => {},
})

export function useTvLayout(): TvLayoutContextValue {
  return useContext(TvLayoutContext)
}

export const Route = createFileRoute('/_tv')({
  component: TvLayout,
})

export function TvLayout() {
  const [guideVisible, setGuideVisible] = useState(true)

  const toggleGuide = (): void => {
    setGuideVisible((prev) => !prev)
  }

  return (
    <TvLayoutContext.Provider value={{ guideVisible, toggleGuide }}>
      <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-black">
        {/* CRT scanline overlay */}
        <div className="crt-overlay" aria-hidden="true" />

        {/* Main TV area: video + guide */}
        <div className="flex min-h-0 flex-1">
          {/* Video player area */}
          <main
            className="relative flex flex-col"
            style={{ width: guideVisible ? '70%' : '100%', backgroundColor: '#050505', transition: 'width 0.2s ease' }}
          >
            <Outlet />
          </main>

          {/* TV guide sidebar — conditionally visible */}
          {guideVisible && (
            <aside
              className="flex flex-col overflow-hidden border-l"
              style={{
                width: '30%',
                borderColor: 'rgba(57,255,20,0.15)',
                backgroundColor: '#0a0a0a',
              }}
            >
              {/* Guide header */}
              <div
                className="shrink-0 border-b px-4 py-3"
                style={{ borderColor: 'rgba(57,255,20,0.15)' }}
              >
                <span
                  className="font-mono text-sm tracking-widest uppercase"
                  style={{ color: '#39ff14', fontFamily: "'VT323', 'Courier New', monospace" }}
                >
                  TV GUIDE
                </span>
              </div>

              {/* Guide content — placeholder for GuideGrid */}
              <div className="flex-1 overflow-y-auto px-2 py-2" id="tv-guide-content">
                <p
                  className="p-3 font-mono text-xs"
                  style={{ color: 'rgba(255,255,255,0.3)', fontFamily: "'VT323', 'Courier New', monospace" }}
                >
                  LOADING GUIDE...
                </p>
              </div>
            </aside>
          )}
        </div>

        {/* Bottom toolbar */}
        <div
          className="shrink-0 border-t px-4 py-2"
          style={{
            borderColor: 'rgba(57,255,20,0.2)',
            backgroundColor: '#0d0d0d',
            minHeight: '3rem',
          }}
        >
          <div className="flex items-center gap-6">
            <span
              className="font-mono text-sm tracking-widest"
              style={{ color: '#39ff14', fontFamily: "'VT323', 'Courier New', monospace" }}
            >
              KRANZTV
            </span>
            <span
              id="channel-info-toolbar"
              className="font-mono text-xs tracking-wider"
              style={{
                color: 'rgba(255,165,0,0.8)',
                fontFamily: "'VT323', 'Courier New', monospace",
              }}
            >
              — SELECT A CHANNEL
            </span>
            <span
              className="ml-auto font-mono text-xs tracking-wider"
              style={{
                color: 'rgba(255,255,255,0.3)',
                fontFamily: "'VT323', 'Courier New', monospace",
              }}
            >
              [G] GUIDE&nbsp;&nbsp;[↑↓] CH&nbsp;&nbsp;[M] MUTE&nbsp;&nbsp;[?] HELP
            </span>
          </div>
        </div>
      </div>
    </TvLayoutContext.Provider>
  )
}
