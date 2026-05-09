import { createContext, useContext } from 'react'

export interface SurfModeContextValue {
  readonly isSurfing: boolean
  readonly countdown: number
  readonly dwellSeconds: number
  readonly startSurf: () => void
  readonly stopSurf: () => void
  readonly setDwellSeconds: (seconds: number) => void
}

const defaultValue: SurfModeContextValue = {
  isSurfing: false,
  countdown: 0,
  dwellSeconds: 15,
  startSurf: () => {},
  stopSurf: () => {},
  setDwellSeconds: () => {},
}

export const SurfModeContext = createContext<SurfModeContextValue>(defaultValue)

export function useSurfModeContext(): SurfModeContextValue {
  const ctx = useContext(SurfModeContext)
  if (ctx === defaultValue) {
    throw new Error(
      'useSurfModeContext must be used within a SurfModeContext.Provider',
    )
  }
  return ctx
}
