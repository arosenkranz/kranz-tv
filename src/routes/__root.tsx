import { HeadContent, Scripts, createRootRoute, Link } from '@tanstack/react-router'
import React, { useEffect } from 'react'

import appCss from '../styles.css?url'
import { initRum } from '~/lib/datadog/rum'
import { initLogs } from '~/lib/datadog/logs'

function NotFound() {
  return (
    <div
      className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-black font-mono"
      style={{ fontFamily: "'VT323', 'Courier New', monospace" }}
    >
      <div className="text-5xl tracking-widest" style={{ color: '#39ff14' }}>
        NO SIGNAL
      </div>
      <div className="text-xl tracking-wider" style={{ color: 'rgba(255,165,0,0.8)' }}>
        CHANNEL NOT FOUND
      </div>
      <Link
        to="/"
        className="mt-4 text-base tracking-widest underline"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        ← RETURN TO LOBBY
      </Link>
    </div>
  )
}

export const Route = createRootRoute({
  notFoundComponent: NotFound,
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content:
          'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no',
      },
      {
        name: 'description',
        content: 'KranzTV - Live cable TV from YouTube playlists',
      },
      {
        title: 'KranzTV',
      },
      {
        name: 'theme-color',
        content: '#0a0a0a',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
    ],
  }),
  shellComponent: RootDocument,
})

// Lazy-loaded only in dev, client-side only — avoids SSR crash on browser-only devtools packages
const LazyDevTools = import.meta.env.DEV
  ? React.lazy(() => import('./-dev-tools'))
  : () => null

function RootDocument({ children }: { children: React.ReactNode }) {
  useEffect(() => { initRum(); initLogs() }, [])

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-black text-white min-h-screen">
        {children}
        {import.meta.env.DEV && typeof window !== 'undefined' && (
          <React.Suspense>
            <LazyDevTools />
          </React.Suspense>
        )}
        <Scripts />
      </body>
    </html>
  )
}
