import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ImportModal } from './import-modal'
import type { Channel } from '~/lib/scheduling/types'

import { importChannel } from '~/lib/import/import-channel'
import { exportChannelsAsJson } from '~/lib/storage/export-channels'
import { importChannelsFromFile } from '~/lib/storage/import-channels-file'

vi.mock('~/lib/import/import-channel', () => ({
  importChannel: vi.fn(),
}))
vi.mock('~/lib/storage/export-channels', () => ({
  exportChannelsAsJson: vi.fn(),
}))
vi.mock('~/lib/storage/import-channels-file', () => ({
  importChannelsFromFile: vi.fn(),
}))

const mockImportChannel = vi.mocked(importChannel)
const mockExportChannelsAsJson = vi.mocked(exportChannelsAsJson)
const mockImportChannelsFromFile = vi.mocked(importChannelsFromFile)

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

    it('shows the ADD CHANNEL tab button', () => {
      render(<ImportModal {...defaultProps} />)
      expect(
        screen.getByRole('button', { name: /add channel tab/i }),
      ).toBeTruthy()
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

async function openManageTab() {
  fireEvent.click(screen.getByRole('button', { name: /manage channels tab/i }))
}

describe('tab navigation', () => {
  it('shows ADD CHANNEL tab by default', () => {
    render(<ImportModal {...defaultProps} />)
    expect(screen.getByPlaceholderText(/youtube.com\/playlist/i)).toBeTruthy()
  })

  it('switches to MANAGE tab when MANAGE button is clicked', async () => {
    render(<ImportModal {...defaultProps} />)
    await openManageTab()
    expect(
      screen.getByRole('button', { name: /export channels/i }),
    ).toBeTruthy()
  })

  it('switches back to ADD CHANNEL tab', async () => {
    render(<ImportModal {...defaultProps} />)
    await openManageTab()
    fireEvent.click(screen.getByRole('button', { name: /add channel tab/i }))
    expect(screen.getByPlaceholderText(/youtube.com\/playlist/i)).toBeTruthy()
  })
})

describe('ManageTab — export', () => {
  it('shows EXPORT CHANNELS button', async () => {
    render(<ImportModal {...defaultProps} customChannels={[MOCK_CHANNEL]} />)
    await openManageTab()
    expect(
      screen.getByRole('button', { name: /export channels/i }),
    ).toBeTruthy()
  })

  it('EXPORT button is disabled when there are no custom channels', async () => {
    render(<ImportModal {...defaultProps} customChannels={[]} />)
    await openManageTab()
    const button = screen.getByRole('button', { name: /export channels/i })
    expect(button).toHaveProperty('disabled', true)
  })

  it('EXPORT button is enabled when custom channels exist', async () => {
    render(<ImportModal {...defaultProps} customChannels={[MOCK_CHANNEL]} />)
    await openManageTab()
    const button = screen.getByRole('button', { name: /export channels/i })
    expect(button).toHaveProperty('disabled', false)
  })

  it('calls exportChannelsAsJson when EXPORT button is clicked', async () => {
    render(<ImportModal {...defaultProps} customChannels={[MOCK_CHANNEL]} />)
    await openManageTab()
    fireEvent.click(screen.getByRole('button', { name: /export channels/i }))
    expect(mockExportChannelsAsJson).toHaveBeenCalledWith([MOCK_CHANNEL])
  })
})

describe('ManageTab — channel list', () => {
  it('shows channel names and numbers in the manage tab', async () => {
    render(<ImportModal {...defaultProps} customChannels={[MOCK_CHANNEL]} />)
    await openManageTab()
    expect(screen.getByText('MY CHANNEL')).toBeTruthy()
    expect(screen.getByText('CH 06')).toBeTruthy()
  })

  it('shows empty state when no custom channels exist', async () => {
    render(<ImportModal {...defaultProps} customChannels={[]} />)
    await openManageTab()
    expect(screen.getByText('NO CUSTOM CHANNELS')).toBeTruthy()
  })

  it('shows EDIT and X buttons for each channel', async () => {
    render(<ImportModal {...defaultProps} customChannels={[MOCK_CHANNEL]} />)
    await openManageTab()
    expect(screen.getByLabelText(/edit my channel/i)).toBeTruthy()
    expect(screen.getByLabelText(/delete my channel/i)).toBeTruthy()
  })
})

describe('ManageTab — editing', () => {
  it('shows inline edit form when EDIT is clicked', async () => {
    render(<ImportModal {...defaultProps} customChannels={[MOCK_CHANNEL]} />)
    await openManageTab()
    fireEvent.click(screen.getByLabelText(/edit my channel/i))
    expect(screen.getByLabelText('Channel name')).toBeTruthy()
    expect(screen.getByLabelText('Channel number')).toBeTruthy()
    expect(screen.getByLabelText('Channel description')).toBeTruthy()
  })

  it('pre-fills the edit form with current values', async () => {
    render(<ImportModal {...defaultProps} customChannels={[MOCK_CHANNEL]} />)
    await openManageTab()
    fireEvent.click(screen.getByLabelText(/edit my channel/i))
    const nameInput =
      screen.getByLabelText<HTMLInputElement>('Channel name')
    const numberInput =
      screen.getByLabelText<HTMLInputElement>('Channel number')
    expect(nameInput.value).toBe('My Channel')
    expect(numberInput.value).toBe('6')
  })

  it('returns to normal row when CANCEL is clicked', async () => {
    render(<ImportModal {...defaultProps} customChannels={[MOCK_CHANNEL]} />)
    await openManageTab()
    fireEvent.click(screen.getByLabelText(/edit my channel/i))
    fireEvent.click(screen.getByLabelText('Cancel editing'))
    expect(screen.queryByLabelText('Channel name')).toBeNull()
    expect(screen.getByText('MY CHANNEL')).toBeTruthy()
  })

  it('disables SAVE when name is empty', async () => {
    render(<ImportModal {...defaultProps} customChannels={[MOCK_CHANNEL]} />)
    await openManageTab()
    fireEvent.click(screen.getByLabelText(/edit my channel/i))
    fireEvent.change(screen.getByLabelText('Channel name'), {
      target: { value: '' },
    })
    const saveBtn = screen.getByLabelText('Save changes')
    expect(saveBtn).toHaveProperty('disabled', true)
  })
})

describe('ManageTab — deleting', () => {
  it('shows confirmation when X is clicked', async () => {
    render(<ImportModal {...defaultProps} customChannels={[MOCK_CHANNEL]} />)
    await openManageTab()
    fireEvent.click(screen.getByLabelText(/delete my channel/i))
    expect(screen.getByText(/DELETE MY CHANNEL\?/)).toBeTruthy()
  })

  it('hides confirmation when NO is clicked', async () => {
    render(<ImportModal {...defaultProps} customChannels={[MOCK_CHANNEL]} />)
    await openManageTab()
    fireEvent.click(screen.getByLabelText(/delete my channel/i))
    fireEvent.click(screen.getByLabelText('Cancel delete'))
    expect(screen.queryByText(/DELETE MY CHANNEL\?/)).toBeNull()
    expect(screen.getByText('MY CHANNEL')).toBeTruthy()
  })
})

describe('ManageTab — import', () => {
  it('shows BROWSE button for file selection', async () => {
    render(<ImportModal {...defaultProps} />)
    await openManageTab()
    expect(screen.getByRole('button', { name: /browse/i })).toBeTruthy()
  })

  it('shows import results on successful file import', async () => {
    mockImportChannelsFromFile.mockResolvedValue({
      success: true,
      merged: [MOCK_CHANNEL],
      importedCount: 1,
      skippedCount: 0,
    })

    render(
      <ImportModal
        {...defaultProps}
        customChannels={[]}
        onImportComplete={vi.fn()}
      />,
    )
    await openManageTab()

    const fileInput =
      document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(fileInput).toBeTruthy()

    const file = new File(['{}'], 'channels.json', { type: 'application/json' })
    await act(async () => {
      fireEvent.change(fileInput!, { target: { files: [file] } })
    })

    await waitFor(() => {
      expect(screen.getByText(/1 IMPORTED/i)).toBeTruthy()
    })
  })

  it('shows error message on failed file import', async () => {
    mockImportChannelsFromFile.mockResolvedValue({
      success: false,
      error: 'INVALID FILE — NOT VALID JSON',
    })

    render(<ImportModal {...defaultProps} />)
    await openManageTab()

    const fileInput =
      document.querySelector<HTMLInputElement>('input[type="file"]')
    const file = new File(['bad'], 'channels.json', {
      type: 'application/json',
    })
    await act(async () => {
      fireEvent.change(fileInput!, { target: { files: [file] } })
    })

    await waitFor(() => {
      expect(screen.getByText(/invalid file/i)).toBeTruthy()
    })
  })
})
