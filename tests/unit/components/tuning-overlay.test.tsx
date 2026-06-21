import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TuningOverlay } from '~/components/tuning-overlay'

describe('TuningOverlay', () => {
  it('renders static + status label while resolving', () => {
    render(
      <TuningOverlay
        channelNumber={3}
        channelName="Lo-Fi"
        isActiveChannel={false}
        status="mounting"
      />,
    )
    expect(screen.getByText('RESOLVING SIGNAL…')).toBeTruthy()
    expect(screen.getByTestId('tuning-static')).toBeTruthy()
  })

  it('renders nothing once playing', () => {
    render(
      <TuningOverlay channelNumber={3} channelName="Lo-Fi" isActiveChannel status="playing" />,
    )
    expect(screen.queryByTestId('tuning-overlay')).toBeNull()
  })

  it('shows NO SIGNAL on error', () => {
    render(
      <TuningOverlay channelNumber={3} channelName="Lo-Fi" isActiveChannel status="error" />,
    )
    expect(screen.getByText('NO SIGNAL')).toBeTruthy()
  })
})
