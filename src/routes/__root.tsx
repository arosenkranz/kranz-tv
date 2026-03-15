import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import React from 'react'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
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
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

// Lazy-loaded only in dev, client-side only — avoids SSR crash on browser-only devtools packages
const LazyDevTools = import.meta.env.DEV
  ? React.lazy(() => import('./-dev-tools'))
  : () => null

function RootDocument({ children }: { children: React.ReactNode }) {
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
