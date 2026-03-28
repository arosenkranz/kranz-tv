export function formatChannelNumber(n: number): string {
  return `CH${String(n).padStart(2, '0')}`
}
