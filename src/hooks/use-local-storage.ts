import { useState, useEffect, useRef, useCallback } from 'react'

function readFromStorage<T>(key: string, initialValue: T): T {
  if (typeof window === 'undefined') return initialValue

  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return initialValue
    return JSON.parse(raw) as T
  } catch {
    return initialValue
  }
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] {
  // Start from initialValue on BOTH the server and the first client render, so
  // the SSR markup and the client's first paint match. Reading localStorage in
  // the initial render (as a useState lazy initializer did) diverges the two
  // whenever a stored value differs from initialValue, causing a React
  // hydration mismatch. The real stored value is read after mount, below.
  const [storedValue, setStoredValue] = useState<T>(initialValue)

  // Tracks whether the caller has written a value since mount — if so, we must
  // not clobber it with the post-mount storage read (which could race).
  const writtenRef = useRef(false)

  useEffect(() => {
    if (writtenRef.current) return
    const fromStorage = readFromStorage(key, initialValue)
    setStoredValue(fromStorage)
    // initialValue is intentionally omitted: re-read only when the key changes,
    // not when a fresh-but-equal initialValue object is passed each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const setValue = useCallback(
    (value: T): void => {
      writtenRef.current = true
      setStoredValue(value)

      if (typeof window === 'undefined') return

      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Storage may be full or access denied — fail silently
      }
    },
    [key],
  )

  return [storedValue, setValue]
}
