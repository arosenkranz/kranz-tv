import { useState, useRef, useCallback } from 'react'

export interface ToastState {
  visible: boolean
  message: string
  detail: string | undefined
  show: (message: string, detail?: string, durationMs?: number) => void
}

export function useToast(): ToastState {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [detail, setDetail] = useState<string | undefined>(undefined)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(
    (msg: string, det?: string, durationMs = 2000): void => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)

      setMessage(msg)
      setDetail(det)
      setVisible(true)

      timerRef.current = setTimeout(() => setVisible(false), durationMs)
    },
    [],
  )

  return { visible, message, detail, show }
}
