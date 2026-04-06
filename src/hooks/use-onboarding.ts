import { useState, useCallback } from 'react'

type OnboardingScope = 'mobile' | 'desktop'

const STORAGE_KEYS: Record<OnboardingScope, string> = {
  mobile: 'kranz-tv:mobile-onboarding-seen',
  desktop: 'kranz-tv:desktop-onboarding-seen',
}

function hasSeenOnboarding(scope: OnboardingScope): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS[scope]) === 'true'
  } catch {
    return false
  }
}

interface UseOnboardingResult {
  readonly needsOnboarding: boolean
  readonly dismissOnboarding: () => void
}

export function useOnboarding(
  scope: OnboardingScope = 'mobile',
): UseOnboardingResult {
  const [needsOnboarding, setNeedsOnboarding] = useState(
    () => !hasSeenOnboarding(scope),
  )

  const dismissOnboarding = useCallback((): void => {
    setNeedsOnboarding(false)
    try {
      localStorage.setItem(STORAGE_KEYS[scope], 'true')
    } catch {
      // localStorage may be unavailable in private browsing
    }
  }, [scope])

  return { needsOnboarding, dismissOnboarding }
}
