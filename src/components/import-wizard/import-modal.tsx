import { useEffect, useRef, useState } from 'react'
import type { Channel } from '~/lib/scheduling/types'
import { useIsMobile } from '~/hooks/use-is-mobile'
import { useTvLayout } from '~/routes/_tv'
import { ImportTab } from './import-tab'
import { ManageTab } from './manage-tab'

const MONO = "'VT323', 'Courier New', monospace"

export interface ImportModalProps {
  visible: boolean
  onClose: () => void
  onImportComplete: (channel: Channel) => void
  customChannels: readonly Channel[]
}

type ActiveTab = 'add' | 'manage'

export function ImportModal({
  visible,
  onClose,
  onImportComplete,
  customChannels,
}: ImportModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const { addCustomChannels } = useTvLayout()
  const [activeTab, setActiveTab] = useState<ActiveTab>('add')

  // Reset to add tab on open
  useEffect(() => {
    if (visible) setActiveTab('add')
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visible, onClose])

  if (!visible) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === backdropRef.current) onClose()
  }

  const tabStyle = (tab: ActiveTab) => ({
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: MONO,
    fontSize: '0.875rem',
    letterSpacing: '0.1em',
    paddingBottom: '4px',
    color: activeTab === tab ? '#ffa500' : 'rgba(255,255,255,0.3)',
    borderBottom:
      activeTab === tab ? '2px solid #ffa500' : '2px solid transparent',
    transition: 'color 150ms, border-color 150ms',
  })

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Import YouTube channel"
    >
      <div
        className="relative rounded border-2 px-4 py-6 sm:px-8"
        style={{
          backgroundColor: '#0d0d0d',
          borderColor: 'rgba(255,165,0,0.7)',
          width: 'min(90vw, 520px)',
          boxShadow: '0 0 30px rgba(255,165,0,0.15)',
        }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-6">
            <button
              style={tabStyle('add')}
              onClick={() => setActiveTab('add')}
              aria-label="Add channel tab"
            >
              ADD CHANNEL
            </button>
            <button
              style={tabStyle('manage')}
              onClick={() => setActiveTab('manage')}
              aria-label="Manage channels tab"
            >
              MANAGE
            </button>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-sm tracking-widest"
            style={{ color: 'rgba(255,255,255,0.4)', fontFamily: MONO }}
            aria-label="Close import modal"
          >
            {isMobile ? '✕' : '[ESC]'}
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'add' && (
          <ImportTab
            customChannels={customChannels}
            onImportComplete={onImportComplete}
            onClose={onClose}
          />
        )}
        {activeTab === 'manage' && (
          <ManageTab
            customChannels={customChannels}
            onClose={onClose}
            onBatchImport={addCustomChannels}
          />
        )}
      </div>
    </div>
  )
}
