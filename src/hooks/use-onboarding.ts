import { useState, useCallback, useEffect } from 'react'

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
  // Start false on both the server and the first client render — reading
  // localStorage in the initial render diverges SSR (localStorage throws →
  // false → needsOnboarding true) from a returning client (seen → false),
  // and even for new users shifts sibling positions during hydration,
  // producing a React hydration mismatch (#86). Resolve it after mount.
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  useEffect(() => {
    if (!hasSeenOnboarding(scope)) {
      setNeedsOnboarding(true)
    }
  }, [scope])

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
