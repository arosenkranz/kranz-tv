import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock @tanstack/react-router before importing the hook
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

import { useChannelNavigation } from './use-channel-navigation'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'

const sortedPresets = [...CHANNEL_PRESETS].sort((a, b) => a.number - b.number)
const firstChannelId = sortedPresets[0]!.id
const lastChannelId = sortedPresets[sortedPresets.length - 1]!.id
const secondChannelId = sortedPresets[1]!.id
const secondToLastId = sortedPresets[sortedPresets.length - 2]!.id

describe('useChannelNavigation', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
  })

  it('returns the correct currentNumber for a known channel', () => {
    const preset = sortedPresets[2]!
    const { result } = renderHook(() => useChannelNavigation(preset.id))
    expect(result.current.currentNumber).toBe(preset.number)
  })

  it('returns -1 as currentNumber for an unknown channel id', () => {
    const { result } = renderHook(() => useChannelNavigation('does-not-exist'))
    expect(result.current.currentNumber).toBe(-1)
  })

  it('returns totalChannels equal to the number of presets', () => {
    const { result } = renderHook(() => useChannelNavigation(firstChannelId))
    expect(result.current.totalChannels).toBe(CHANNEL_PRESETS.length)
  })

  it('goToChannel navigates to /channel/$channelId', () => {
    const { result } = renderHook(() => useChannelNavigation(firstChannelId))
    act(() => {
      result.current.goToChannel('jazz')
    })
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/channel/$channelId',
      params: { channelId: 'jazz' },
    })
  })

  it('nextChannel advances to the next channel in order', () => {
    const { result } = renderHook(() => useChannelNavigation(firstChannelId))
    act(() => {
      result.current.nextChannel()
    })
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/channel/$channelId',
      params: { channelId: secondChannelId },
    })
  })

  it('nextChannel wraps from last channel to first', () => {
    const { result } = renderHook(() => useChannelNavigation(lastChannelId))
    act(() => {
      result.current.nextChannel()
    })
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/channel/$channelId',
      params: { channelId: firstChannelId },
    })
  })

  it('prevChannel goes to the previous channel in order', () => {
    const { result } = renderHook(() => useChannelNavigation(secondChannelId))
    act(() => {
      result.current.prevChannel()
    })
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/channel/$channelId',
      params: { channelId: firstChannelId },
    })
  })

  it('prevChannel wraps from first channel to last', () => {
    const { result } = renderHook(() => useChannelNavigation(firstChannelId))
    act(() => {
      result.current.prevChannel()
    })
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/channel/$channelId',
      params: { channelId: lastChannelId },
    })
  })

  it('nextChannel from unknown channel id goes to the first channel', () => {
    const { result } = renderHook(() => useChannelNavigation('unknown-id'))
    act(() => {
      result.current.nextChannel()
    })
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/channel/$channelId',
      params: { channelId: firstChannelId },
    })
  })

  it('prevChannel from unknown channel id goes to the last channel', () => {
    const { result } = renderHook(() => useChannelNavigation('unknown-id'))
    act(() => {
      result.current.prevChannel()
    })
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/channel/$channelId',
      params: { channelId: lastChannelId },
    })
  })

  it('navigates to second-to-last when calling prevChannel on last', () => {
    const { result } = renderHook(() => useChannelNavigation(lastChannelId))
    act(() => {
      result.current.prevChannel()
    })
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/channel/$channelId',
      params: { channelId: secondToLastId },
    })
  })
})
