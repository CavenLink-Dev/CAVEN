import { memo, useMemo } from 'react'
import type { CalendarEvent } from '../../lib/mockData'
import { useCavenStore } from '../../lib/store'
import { todayLabel } from '../../lib/today'
import { dayKey, dayLabel, parseStamp } from '../../../shared/when'
import { GlassPanel, PanelNote } from './GlassPanel'

const KIND_LABEL: Record<CalendarEvent['kind'], string> = {
  routine: 'Routine',
  event: 'Event',
  reminder: 'Reminder',
}

/** "10:30", "6:00 pm", "19:00" → minutes past midnight. null when it can't be read. */
function minutesOf(time: string): number | null {
  const match = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(time.trim())
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2] ?? '0')
  const suffix = match[3]?.toLowerCase()
  if (hour > 23 || minute > 59) return null
  if (suffix === 'pm' && hour < 12) hour += 12
  if (suffix === 'am' && hour === 12) hour = 0
  return hour * 60 + minute
}

function EventRow({ event, active, day }: { event: CalendarEvent; active: boolean; day?: string }) {
  return (
    <div className="event-row">
      <time className={active ? 'text-cyan-200' : ''}>{event.time}</time>
      <span className="event-line">
        <b>{event.title}</b>
        <small>{day ? `${day} · ${KIND_LABEL[event.kind] ?? 'Event'}` : (KIND_LABEL[event.kind] ?? 'Event')}</small>
      </span>
    </div>
  )
}

function CalendarCardBase({ isVisible = true }: { isVisible?: boolean }) {
  const { data, ready, status, loadFailed, reload } = useCavenStore()
  const events = data.calendar
  const dateLabel = useMemo(() => todayLabel(), [])

  // Until events carried a date, everything sat under Today whatever day it was
  // actually for. Now the day decides: today's entries fill the card, anything
  // later is still shown — under its own day, so nothing silently disappears —
  // and anything already past drops off. Events saved before dates existed have
  // no `at` at all, and those were every one of them written as today.
  const { today, ahead, activeId } = useMemo(() => {
    const now = new Date()
    const key = dayKey(now)
    const minutesNow = now.getHours() * 60 + now.getMinutes()

    const dated = events.map(event => ({ event, at: parseStamp(event.at) }))
    const byClock = (a: { event: CalendarEvent }, b: { event: CalendarEvent }) =>
      (minutesOf(a.event.time) ?? 1e6) - (minutesOf(b.event.time) ?? 1e6)

    const today = dated.filter(({ at }) => !at || dayKey(at) === key).sort(byClock)
    const ahead = dated
      .filter(({ at }) => at && dayKey(at) > key)
      .sort((a, b) => (a.at as Date).getTime() - (b.at as Date).getTime())
      .map(({ event, at }) => ({ event, day: dayLabel(at as Date, now) }))

    // Whatever is next on the clock today, and nothing once the day is behind us.
    let best: { id: string; at: number } | null = null
    for (const { event } of today) {
      const at = minutesOf(event.time)
      if (at === null || at < minutesNow) continue
      if (!best || at < best.at) best = { id: event.id, at }
    }

    return { today: today.map(({ event }) => event), ahead, activeId: best?.id ?? null }
  }, [events])

  return (
    <GlassPanel
      label="Today Calendar"
      title={dateLabel}
      isVisible={isVisible}
      headerRelative
    >
      <div className="space-y-3 board-list-scroll">
        {!ready ? (
          <PanelNote onRetry={loadFailed ? reload : undefined}>{status}</PanelNote>
        ) : today.length === 0 && ahead.length === 0 ? (
          <PanelNote>Nothing in the diary for today.</PanelNote>
        ) : (
          <>
            {today.length === 0 ? (
              <PanelNote>Nothing in the diary for today.</PanelNote>
            ) : (
              today.map(event => <EventRow key={event.id} event={event} active={event.id === activeId} />)
            )}
            {ahead.length > 0 && (
              <>
                <p className="hud-label pt-1 text-cyan-300/70">Later</p>
                {ahead.map(({ event, day }) => (
                  <EventRow key={event.id} event={event} active={false} day={day} />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </GlassPanel>
  )
}

// Memoised: useCaven() streams amplitude from App, and without this every
// frame of CAVEN speaking re-rendered this component for no reason.
export const CalendarCard = memo(CalendarCardBase)
