import { useState } from 'react'

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

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => readFromStorage(key, initialValue))

  const setValue = (value: T): void => {
    setStoredValue(value)

    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage may be full or access denied — fail silently
    }
  }

  return [storedValue, setValue]
}
