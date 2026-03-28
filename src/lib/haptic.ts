export function vibrate(ms = 10): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(ms)
  }
}
