import { memo, useEffect, useRef, useState } from 'react'
import mark from '../../imports/caven-mark.png'
import type { Page } from './TopBar'

// Navigation, at the bottom and out of the way.
//
// It used to be a bordered segment control directly above the orb, which put a
// row of chrome between you and the only control that matters. Down here it is
// a line of quiet text under the command box: visible, one click deep, and not
// competing with anything.

/** More opens upward onto the Settings page, at the section it names. */
const MORE: { id: string; label: string }[] = [
  { id: 'settings', label: 'Settings' },
  { id: 'integration', label: 'Integration' },
  { id: 'account', label: 'Account' },
  { id: 'help', label: 'Help' },
]

const PAGES: { id: Page; label: string }[] = [
  { id: 'main', label: 'Caven' },
  { id: 'mission', label: 'Mission Control' },
  { id: 'journal', label: 'Journal' },
  { id: 'brain', label: 'Brain' },
]

function BottomNavBase({
  page,
  onPageChange,
  onSection,
}: {
  page: Page
  onPageChange: (p: Page) => void
  onSection: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on a click elsewhere or on Escape — a menu you cannot dismiss by
  // looking away is its own small irritation.
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <nav className="bottom-nav" aria-label="Pages" ref={rootRef}>
      <button
        type="button"
        className="bottom-nav-mark"
        onClick={() => onPageChange('main')}
        aria-label="CAVEN — back to the core"
      >
        <img src={mark} alt="" />
      </button>

      {PAGES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={`bottom-nav-item${page === id ? ' is-active' : ''}`}
          onClick={() => onPageChange(id)}
          aria-current={page === id ? 'page' : undefined}
        >
          {label}
        </button>
      ))}

      <div className="bottom-nav-more">
        <button
          type="button"
          className={`bottom-nav-item${page === 'settings' ? ' is-active' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          More <span className="bottom-nav-caret" aria-hidden="true">▾</span>
        </button>
        {open && (
          <div className="bottom-nav-menu" role="menu">
            {MORE.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="menuitem"
                className="bottom-nav-menu-item"
                onClick={() => {
                  setOpen(false)
                  onSection(id)
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}

export const BottomNav = memo(BottomNavBase)
