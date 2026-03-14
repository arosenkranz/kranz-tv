import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'

export interface ChannelNavEntry {
  readonly id: string
  readonly number: number
}

export interface ChannelNavigation {
  goToChannel: (channelId: string) => void
  nextChannel: () => void
  prevChannel: () => void
  currentNumber: number
  totalChannels: number
}

export function useChannelNavigation(
  currentChannelId: string,
  allChannels: ReadonlyArray<ChannelNavEntry>,
): ChannelNavigation {
  const navigate = useNavigate()

  const sortedChannels = useMemo(
    () => [...allChannels].sort((a, b) => a.number - b.number),
    [allChannels],
  )

  const currentIndex = sortedChannels.findIndex(
    (p) => p.id === currentChannelId,
  )
  const currentNumber =
    currentIndex >= 0 ? (sortedChannels[currentIndex]?.number ?? -1) : -1
  const totalChannels = sortedChannels.length

  const goToChannel = (channelId: string): void => {
    void navigate({ to: '/channel/$channelId', params: { channelId } })
  }

  const nextChannel = (): void => {
    if (sortedChannels.length === 0) return
    const nextIndex =
      currentIndex >= 0 ? (currentIndex + 1) % sortedChannels.length : 0
    goToChannel(sortedChannels[nextIndex].id)
  }

  const prevChannel = (): void => {
    if (sortedChannels.length === 0) return
    const prevIndex =
      currentIndex > 0 ? currentIndex - 1 : sortedChannels.length - 1
    goToChannel(sortedChannels[prevIndex].id)
  }

  return { goToChannel, nextChannel, prevChannel, currentNumber, totalChannels }
}
