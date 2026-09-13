import type { ReactNode } from 'react'
import { memo, useEffect, useState } from 'react'
import { useCavenStore } from '../../lib/store'
import { addressOf } from '../../../shared/address'

// The top of the screen says two things and no more: who you are being greeted
// as, and what time it is. Navigation used to live here and is now at the very
// bottom (BottomNav) — a row of chrome directly above the orb was the thing most
// in the way of the one control that matters.

export type Page = 'main' | 'mission' | 'journal' | 'brain' | 'settings'

/** What each page calls itself, where the greeting would otherwise be. */
export const PAGE_TITLE: Record<Exclude<Page, 'main'>, string> = {
  mission: 'Mission Control',
  journal: 'Journal',
  brain: 'Brain',
  settings: 'Settings',
}

const TIME_FMT = new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
const DATE_FMT = new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })

/** "10:35am" — the space before the meridiem is noise at this size. */
function clockOf(now: Date): string {
  return TIME_FMT.format(now).replace(/\s+/g, '').toLowerCase()
}

function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    // Land on the minute rather than drifting a few seconds past it.
    let timer: number
    const tick = () => {
      setNow(new Date())
      timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000))
    }
    timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000))
    return () => window.clearTimeout(timer)
  }, [])
  return now
}

/** Morning until noon, afternoon until six, evening after that. */
function greetingFor(now: Date): string {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function TopBarBase({ page, actions }: { page: Page; actions?: ReactNode }) {
  const now = useNow()
  // Addressed however he has told CAVEN to address him, so the greeting and the
  // voice agree. Capitalised here because it opens the sentence.
  const { data } = useCavenStore()
  const term = addressOf(data)
  const title = page === 'main' ? `${greetingFor(now)}, ${term.charAt(0).toUpperCase()}${term.slice(1)}` : PAGE_TITLE[page]

  return (
    <header className="topbar">
      <div className="topbar-lead">
        <h1 className="topbar-greeting">{title}</h1>
        <p className="topbar-date">{DATE_FMT.format(now)}</p>
      </div>
      <div className="topbar-side">
        <time className="topbar-clock" dateTime={now.toISOString()}>
          {clockOf(now)}
        </time>
        {actions}
      </div>
    </header>
  )
}

// Memoised: useCaven() streams amplitude from App, and without this every frame
// of CAVEN speaking would re-render this for no reason.
export const TopBar = memo(TopBarBase)
