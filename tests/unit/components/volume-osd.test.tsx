import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { VolumeOsd } from '../../../src/components/volume-osd'

describe('VolumeOsd', () => {
  it('renders nothing visible when visible=false (opacity 0)', () => {
    const { container } = render(
      <VolumeOsd volume={80} isMuted={false} visible={false} />,
    )
    const osd = container.firstChild as HTMLElement
    expect(osd.style.opacity).toBe('0')
  })

  it('renders with opacity 1 when visible=true', () => {
    const { container } = render(
      <VolumeOsd volume={80} isMuted={false} visible={true} />,
    )
    const osd = container.firstChild as HTMLElement
    expect(osd.style.opacity).toBe('1')
  })

  it('renders 10 segments total', () => {
    render(<VolumeOsd volume={80} isMuted={false} visible={true} />)
    const segments = screen.getAllByTestId('volume-segment')
    expect(segments).toHaveLength(10)
  })

  it('shows VOL label when not muted', () => {
    render(<VolumeOsd volume={80} isMuted={false} visible={true} />)
    expect(screen.getByText('VOL')).toBeDefined()
  })

  it('shows MUTED label when muted', () => {
    render(<VolumeOsd volume={80} isMuted={true} visible={true} />)
    expect(screen.getByText('MUTED')).toBeDefined()
  })

  it('shows correct numeric volume value', () => {
    render(<VolumeOsd volume={65} isMuted={false} visible={true} />)
    expect(screen.getByText('65')).toBeDefined()
  })

  it('fills correct number of segments at volume 80 (8 of 10)', () => {
    render(<VolumeOsd volume={80} isMuted={false} visible={true} />)
    const segments = screen.getAllByTestId('volume-segment')
    const filled = segments.filter(
      (s) => (s).style.backgroundColor === 'rgb(57, 255, 20)',
    )
    expect(filled).toHaveLength(8)
  })

  it('fills 0 segments at volume 0', () => {
    render(<VolumeOsd volume={0} isMuted={false} visible={true} />)
    const segments = screen.getAllByTestId('volume-segment')
    const greenFilled = segments.filter(
      (s) => (s).style.backgroundColor === 'rgb(57, 255, 20)',
    )
    expect(greenFilled).toHaveLength(0)
  })

  it('fills all 10 segments at volume 100', () => {
    render(<VolumeOsd volume={100} isMuted={false} visible={true} />)
    const segments = screen.getAllByTestId('volume-segment')
    const greenFilled = segments.filter(
      (s) => (s).style.backgroundColor === 'rgb(57, 255, 20)',
    )
    expect(greenFilled).toHaveLength(10)
  })

  it('dims segments when muted (no bright green)', () => {
    render(<VolumeOsd volume={80} isMuted={true} visible={true} />)
    const segments = screen.getAllByTestId('volume-segment')
    const brightGreen = segments.filter(
      (s) => (s).style.backgroundColor === 'rgb(57, 255, 20)',
    )
    expect(brightGreen).toHaveLength(0)
  })

  it('has pointer-events none so it never blocks the player', () => {
    const { container } = render(
      <VolumeOsd volume={80} isMuted={false} visible={true} />,
    )
    const osd = container.firstChild as HTMLElement
    expect(osd.style.pointerEvents).toBe('none')
  })
})
