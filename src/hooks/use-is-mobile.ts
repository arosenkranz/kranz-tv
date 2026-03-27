import { useMediaQuery } from '~/hooks/use-media-query'

export function useIsMobile(): boolean {
  return useMediaQuery(
    '(max-width: 639px), (pointer: coarse) and (max-height: 639px)',
  )
}
