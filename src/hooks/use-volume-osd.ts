import { useState, useEffect, useRef } from 'react'

export interface VolumeOsdState {
  visible: boolean
  displayVolume: number
  displayMuted: boolean
}

export function useVolumeOsd(volume: number, isMuted: boolean): VolumeOsdState {
  const [visible, setVisible] = useState(false)
  const isFirstRender = useRef(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    setVisible(true)

    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), 2000)

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [volume, isMuted])

  return { visible, displayVolume: volume, displayMuted: isMuted }
}
