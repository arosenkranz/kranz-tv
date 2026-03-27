import tracer from 'dd-trace'

function formatTags(tags?: Record<string, string>): string[] {
  if (!tags) return []
  return Object.entries(tags).map(([k, v]) => `${k}:${v}`)
}

export function incrementMetric(
  name: string,
  tags?: Record<string, string>,
): void {
  tracer.dogstatsd.increment(name, 1, formatTags(tags))
}

export function recordHistogram(
  name: string,
  value: number,
  tags?: Record<string, string>,
): void {
  tracer.dogstatsd.histogram(name, value, formatTags(tags))
}
