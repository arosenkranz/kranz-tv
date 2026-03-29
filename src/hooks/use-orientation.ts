import { useState, useEffect } from 'react'

type Orientation = 'portrait' | 'landscape'

function getOrientation(): Orientation {
  if (typeof window === 'undefined') return 'portrait'

  return window.matchMedia('(orientation: landscape)').matches
    ? 'landscape'
    : 'portrait'
}

export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(getOrientation)

  useEffect(() => {
    const update = (): void => setOrientation(getOrientation())
    const mql = window.matchMedia('(orientation: landscape)')
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return orientation
}
