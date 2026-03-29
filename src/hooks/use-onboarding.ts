import { useState, useCallback } from 'react'

const STORAGE_KEY = 'kranz-tv:mobile-onboarding-seen'

function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

interface UseOnboardingResult {
  readonly needsOnboarding: boolean
  readonly dismissOnboarding: () => void
}

export function useOnboarding(): UseOnboardingResult {
  const [needsOnboarding, setNeedsOnboarding] = useState(
    () => !hasSeenOnboarding(),
  )

  const dismissOnboarding = useCallback((): void => {
    setNeedsOnboarding(false)
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // localStorage may be unavailable in private browsing
    }
  }, [])

  return { needsOnboarding, dismissOnboarding }
}
