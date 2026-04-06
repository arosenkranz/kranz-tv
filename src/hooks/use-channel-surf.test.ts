import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChannelSurf } from './use-channel-surf'
import type { ChannelPreset } from '~/lib/channels/types'

const makePreset = (overrides: Partial<ChannelPreset> = {}): ChannelPreset => ({
  id: 'test',
  number: 1,
  name: 'Test Channel',
  description: 'A test channel',
  playlistId: 'PLtest',
  emoji: '📺',
  ...overrides,
})

describe('useChannelSurf', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not show static for direct navigation', () => {
    const { result } = renderHook(() => useChannelSurf())
    const preset = makePreset()

    act(() => {
      // Default source is 'direct'
      result.current.triggerSurf(preset)
    })

    expect(result.current.surfState.showStatic).toBe(false)
    expect(result.current.surfState.showOsd).toBe(false)
    expect(result.current.surfState.navigationSource).toBe('direct')
  })

  it('shows static and OSD for keyboard navigation', () => {
    const { result } = renderHook(() => useChannelSurf())
    const preset = makePreset()

    act(() => {
      result.current.setNavigationSource('keyboard')
      result.current.triggerSurf(preset)
    })

    expect(result.current.surfState.showStatic).toBe(true)
    expect(result.current.surfState.showOsd).toBe(true)
    expect(result.current.surfState.channel).toEqual(preset)
    expect(result.current.surfState.navigationSource).toBe('keyboard')
  })

  it('resets source to direct after trigger', () => {
    const { result } = renderHook(() => useChannelSurf())
    const preset1 = makePreset({ id: 'ch1', number: 1 })
    const preset2 = makePreset({ id: 'ch2', number: 2 })

    act(() => {
      result.current.setNavigationSource('keyboard')
      result.current.triggerSurf(preset1)
    })

    // Second trigger without setting source should not animate
    act(() => {
      result.current.triggerSurf(preset2)
    })

    // OSD should still show channel 1 (channel 2 was direct, no update)
    expect(result.current.surfState.channel).toEqual(preset1)
  })

  it('fades out static after quiet period + duration', () => {
    const { result } = renderHook(() => useChannelSurf())
    const preset = makePreset()

    act(() => {
      result.current.setNavigationSource('keyboard')
      result.current.triggerSurf(preset)
    })

    expect(result.current.surfState.showStatic).toBe(true)

    // Advance past quiet period (300ms)
    act(() => {
      vi.advanceTimersByTime(300)
    })

    // Static still visible — duration timer just started
    expect(result.current.surfState.showStatic).toBe(true)

    // Advance past static duration (370ms)
    act(() => {
      vi.advanceTimersByTime(370)
    })

    expect(result.current.surfState.showStatic).toBe(false)
  })

  it('fades out OSD after quiet period + linger', () => {
    const { result } = renderHook(() => useChannelSurf())
    const preset = makePreset()

    act(() => {
      result.current.setNavigationSource('keyboard')
      result.current.triggerSurf(preset)
    })

    expect(result.current.surfState.showOsd).toBe(true)

    // Advance past quiet period (300ms) + OSD linger (2000ms)
    act(() => {
      vi.advanceTimersByTime(300 + 2000)
    })

    expect(result.current.surfState.showOsd).toBe(false)
  })

  it('resets timers on rapid-fire surfing', () => {
    const { result } = renderHook(() => useChannelSurf())
    const preset1 = makePreset({ id: 'ch1', number: 1, name: 'Channel 1' })
    const preset2 = makePreset({ id: 'ch2', number: 2, name: 'Channel 2' })
    const preset3 = makePreset({ id: 'ch3', number: 3, name: 'Channel 3' })

    // Rapid-fire: 3 channel switches in quick succession
    act(() => {
      result.current.setNavigationSource('keyboard')
      result.current.triggerSurf(preset1)
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    act(() => {
      result.current.setNavigationSource('keyboard')
      result.current.triggerSurf(preset2)
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    act(() => {
      result.current.setNavigationSource('keyboard')
      result.current.triggerSurf(preset3)
    })

    // Static should still be visible throughout
    expect(result.current.surfState.showStatic).toBe(true)
    expect(result.current.surfState.showOsd).toBe(true)
    // OSD text should show the latest channel
    expect(result.current.surfState.channel).toEqual(preset3)

    // Now wait for quiet period + static duration
    act(() => {
      vi.advanceTimersByTime(300 + 370)
    })

    expect(result.current.surfState.showStatic).toBe(false)
    // OSD should still be visible (linger not elapsed yet)
    expect(result.current.surfState.showOsd).toBe(true)

    // Wait for remaining OSD linger
    act(() => {
      vi.advanceTimersByTime(2000 - 370)
    })

    expect(result.current.surfState.showOsd).toBe(false)
  })

  it('updates OSD text immediately during rapid surfing', () => {
    const { result } = renderHook(() => useChannelSurf())
    const preset1 = makePreset({ id: 'ch1', number: 1, name: 'First' })
    const preset2 = makePreset({ id: 'ch2', number: 2, name: 'Second' })

    act(() => {
      result.current.setNavigationSource('keyboard')
      result.current.triggerSurf(preset1)
    })

    expect(result.current.surfState.channel?.name).toBe('First')

    act(() => {
      result.current.setNavigationSource('keyboard')
      result.current.triggerSurf(preset2)
    })

    expect(result.current.surfState.channel?.name).toBe('Second')
  })

  it('shows static and OSD for surf navigation', () => {
    const { result } = renderHook(() => useChannelSurf())
    const preset = makePreset()

    act(() => {
      result.current.setNavigationSource('surf')
      result.current.triggerSurf(preset)
    })

    expect(result.current.surfState.showStatic).toBe(true)
    expect(result.current.surfState.showOsd).toBe(true)
    expect(result.current.surfState.channel).toEqual(preset)
    expect(result.current.surfState.navigationSource).toBe('surf')
  })

  it('uses shorter timings for surf navigation — no quiet period', () => {
    const { result } = renderHook(() => useChannelSurf())
    const preset = makePreset()

    act(() => {
      result.current.setNavigationSource('surf')
      result.current.triggerSurf(preset)
    })

    expect(result.current.surfState.showStatic).toBe(true)

    // Surf static duration is 150ms — no quiet period
    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(result.current.surfState.showStatic).toBe(false)
  })

  it('fades out surf OSD after 1000ms — no quiet period', () => {
    const { result } = renderHook(() => useChannelSurf())
    const preset = makePreset()

    act(() => {
      result.current.setNavigationSource('surf')
      result.current.triggerSurf(preset)
    })

    expect(result.current.surfState.showOsd).toBe(true)

    // Surf OSD linger is 1000ms — no quiet period
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.surfState.showOsd).toBe(false)
  })

  it('tracks navigationSource as direct by default', () => {
    const { result } = renderHook(() => useChannelSurf())

    expect(result.current.surfState.navigationSource).toBe('direct')
  })
})
