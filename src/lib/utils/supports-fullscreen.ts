export function supportsFullscreen(): boolean {
  if (typeof document === 'undefined') return false
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => void
  }
  return (
    typeof el.requestFullscreen === 'function' ||
    typeof el.webkitRequestFullscreen === 'function'
  )
}
