import type { Video } from '~/lib/scheduling/types'

export function getThumbnailUrl(video: Video): string {
  return (
    video.thumbnailUrl || `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`
  )
}
