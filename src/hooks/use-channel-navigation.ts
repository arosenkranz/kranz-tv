import { useNavigate } from '@tanstack/react-router'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'

const sortedPresets = [...CHANNEL_PRESETS].sort((a, b) => a.number - b.number)

export interface ChannelNavigation {
  goToChannel: (channelId: string) => void
  nextChannel: () => void
  prevChannel: () => void
  currentNumber: number
  totalChannels: number
}

export function useChannelNavigation(currentChannelId: string): ChannelNavigation {
  const navigate = useNavigate()

  const currentIndex = sortedPresets.findIndex((p) => p.id === currentChannelId)
  const currentNumber = currentIndex >= 0 ? sortedPresets[currentIndex]!.number : -1
  const totalChannels = sortedPresets.length

  const goToChannel = (channelId: string): void => {
    void navigate({ to: '/channel/$channelId', params: { channelId } })
  }

  const nextChannel = (): void => {
    if (sortedPresets.length === 0) return
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % sortedPresets.length : 0
    const next = sortedPresets[nextIndex]
    if (next) goToChannel(next.id)
  }

  const prevChannel = (): void => {
    if (sortedPresets.length === 0) return
    const prevIndex =
      currentIndex > 0 ? currentIndex - 1 : sortedPresets.length - 1
    const prev = sortedPresets[prevIndex]
    if (prev) goToChannel(prev.id)
  }

  return { goToChannel, nextChannel, prevChannel, currentNumber, totalChannels }
}
