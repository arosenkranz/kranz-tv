import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  // Always start false (matches SSR output) — useEffect corrects to real value
  // after hydration. This prevents React hydration mismatches on mobile.
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)

    const handler = (e: MediaQueryListEvent): void => setMatches(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])

  return matches
}
