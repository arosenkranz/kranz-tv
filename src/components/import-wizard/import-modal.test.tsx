import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ImportModal } from './import-modal'
import type { Channel } from '~/lib/scheduling/types'

import { importChannel } from '~/lib/import/import-channel'

vi.mock('~/lib/import/import-channel', () => ({
  importChannel: vi.fn(),
}))
const mockImportChannel = vi.mocked(importChannel)

const MOCK_CHANNEL: Channel = {
  id: 'my-channel',
  number: 6,
  name: 'My Channel',
  playlistId: 'PLxyz123',
  videos: [
    { id: 'v1', title: 'Video 1', durationSeconds: 100, thumbnailUrl: '' },
    { id: 'v2', title: 'Video 2', durationSeconds: 200, thumbnailUrl: '' },
  ],
  totalDurationSeconds: 300,
}

const defaultProps = {
  visible: true,
  onClose: vi.fn(),
  onImportComplete: vi.fn(),
  customChannels: [] as readonly Channel[],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ImportModal', () => {
  describe('visibility', () => {
    it('renders nothing when visible is false', () => {
      render(<ImportModal {...defaultProps} visible={false} />)
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('renders the dialog when visible is true', () => {
      render(<ImportModal {...defaultProps} />)
      expect(screen.getByRole('dialog')).toBeTruthy()
    })

    it('shows the IMPORT CHANNEL heading', () => {
      render(<ImportModal {...defaultProps} />)
      expect(screen.getByText('IMPORT CHANNEL')).toBeTruthy()
    })
  })

  describe('input state', () => {
    it('renders URL input field', () => {
      render(<ImportModal {...defaultProps} />)
      expect(screen.getByPlaceholderText(/youtube.com\/playlist/i)).toBeTruthy()
    })

    it('renders channel name input field', () => {
      render(<ImportModal {...defaultProps} />)
      expect(screen.getByPlaceholderText(/my custom channel/i)).toBeTruthy()
    })

    it('IMPORT button is disabled when inputs are empty', () => {
      render(<ImportModal {...defaultProps} />)
      const button = screen.getByRole('button', { name: /import$/i })
      expect(button).toHaveProperty('disabled', true)
    })

    it('IMPORT button becomes enabled when both fields have values', async () => {
      render(<ImportModal {...defaultProps} />)
      fireEvent.change(screen.getByPlaceholderText(/youtube.com\/playlist/i), {
        target: { value: 'https://www.youtube.com/playlist?list=PLxyz123' },
      })
      fireEvent.change(screen.getByPlaceholderText(/my custom channel/i), {
        target: { value: 'My Channel' },
      })
      const button = screen.getByRole('button', { name: /import$/i })
      expect(button).toHaveProperty('disabled', false)
    })
  })

  describe('close behavior', () => {
    it('calls onClose when ESC close button is clicked', () => {
      const onClose = vi.fn()
      render(<ImportModal {...defaultProps} onClose={onClose} />)
      fireEvent.click(screen.getByLabelText('Close import modal'))
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('calls onClose when backdrop is clicked', () => {
      const onClose = vi.fn()
      render(<ImportModal {...defaultProps} onClose={onClose} />)
      const dialog = screen.getByRole('dialog')
      fireEvent.click(dialog)
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  describe('loading state', () => {
    it('shows TUNING IN... while importing', async () => {
      mockImportChannel.mockImplementation(() => new Promise(() => {}))

      render(<ImportModal {...defaultProps} />)
      fireEvent.change(screen.getByPlaceholderText(/youtube.com\/playlist/i), {
        target: { value: 'https://youtube.com/playlist?list=PLxyz123' },
      })
      fireEvent.change(screen.getByPlaceholderText(/my custom channel/i), {
        target: { value: 'Test' },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /import$/i }))
      })

      expect(screen.getByText('TUNING IN...')).toBeTruthy()
    })
  })

  describe('error state', () => {
    it('shows error message on import failure', async () => {
      mockImportChannel.mockResolvedValue({
        success: false,
        error: 'Playlist not found.',
      })

      render(<ImportModal {...defaultProps} />)
      fireEvent.change(screen.getByPlaceholderText(/youtube.com\/playlist/i), {
        target: { value: 'https://youtube.com/playlist?list=PLxyz123' },
      })
      fireEvent.change(screen.getByPlaceholderText(/my custom channel/i), {
        target: { value: 'Test' },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /import$/i }))
      })

      await waitFor(() => {
        expect(screen.getByText('Playlist not found.')).toBeTruthy()
      })
    })

    it('shows TRY AGAIN button on error', async () => {
      mockImportChannel.mockResolvedValue({
        success: false,
        error: 'Some error',
      })

      render(<ImportModal {...defaultProps} />)
      fireEvent.change(screen.getByPlaceholderText(/youtube.com\/playlist/i), {
        target: { value: 'https://youtube.com/playlist?list=PLxyz123' },
      })
      fireEvent.change(screen.getByPlaceholderText(/my custom channel/i), {
        target: { value: 'Test' },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /import$/i }))
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
      })
    })

    it('returns to input state when TRY AGAIN is clicked', async () => {
      mockImportChannel.mockResolvedValue({
        success: false,
        error: 'Some error',
      })

      render(<ImportModal {...defaultProps} />)
      fireEvent.change(screen.getByPlaceholderText(/youtube.com\/playlist/i), {
        target: { value: 'https://youtube.com/playlist?list=PLxyz123' },
      })
      fireEvent.change(screen.getByPlaceholderText(/my custom channel/i), {
        target: { value: 'Test' },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /import$/i }))
      })

      await waitFor(() => screen.getByRole('button', { name: /try again/i }))
      fireEvent.click(screen.getByRole('button', { name: /try again/i }))

      expect(screen.getByRole('button', { name: /import$/i })).toBeTruthy()
    })
  })

  describe('success state', () => {
    it('shows CHANNEL ADDED on success', async () => {
      mockImportChannel.mockResolvedValue({
        success: true,
        channel: MOCK_CHANNEL,
      })

      render(<ImportModal {...defaultProps} />)
      fireEvent.change(screen.getByPlaceholderText(/youtube.com\/playlist/i), {
        target: { value: 'https://youtube.com/playlist?list=PLxyz123' },
      })
      fireEvent.change(screen.getByPlaceholderText(/my custom channel/i), {
        target: { value: 'My Channel' },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /import$/i }))
      })

      await waitFor(() => {
        expect(screen.getByText('CHANNEL ADDED')).toBeTruthy()
      })
    })

    it('calls onImportComplete with channel when WATCH NOW is clicked', async () => {
      const onImportComplete = vi.fn()
      mockImportChannel.mockResolvedValue({
        success: true,
        channel: MOCK_CHANNEL,
      })

      render(
        <ImportModal {...defaultProps} onImportComplete={onImportComplete} />,
      )
      fireEvent.change(screen.getByPlaceholderText(/youtube.com\/playlist/i), {
        target: { value: 'https://youtube.com/playlist?list=PLxyz123' },
      })
      fireEvent.change(screen.getByPlaceholderText(/my custom channel/i), {
        target: { value: 'My Channel' },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /import$/i }))
      })

      await waitFor(() => screen.getByRole('button', { name: /watch now/i }))
      fireEvent.click(screen.getByRole('button', { name: /watch now/i }))

      expect(onImportComplete).toHaveBeenCalledWith(MOCK_CHANNEL)
    })

    it('calls onClose when CLOSE button is clicked from success state', async () => {
      const onClose = vi.fn()
      mockImportChannel.mockResolvedValue({
        success: true,
        channel: MOCK_CHANNEL,
      })

      render(<ImportModal {...defaultProps} onClose={onClose} />)
      fireEvent.change(screen.getByPlaceholderText(/youtube.com\/playlist/i), {
        target: { value: 'https://youtube.com/playlist?list=PLxyz123' },
      })
      fireEvent.change(screen.getByPlaceholderText(/my custom channel/i), {
        target: { value: 'My Channel' },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /import$/i }))
      })

      await waitFor(() => screen.getByRole('button', { name: /^close$/i }))
      fireEvent.click(screen.getByRole('button', { name: /^close$/i }))

      expect(onClose).toHaveBeenCalledOnce()
    })
  })
})
