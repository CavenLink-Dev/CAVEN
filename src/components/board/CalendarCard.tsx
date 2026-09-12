import { memo, useMemo, useState } from 'react'
import type { CalendarEvent } from '../../lib/mockData'
import { useCavenStore } from '../../lib/store'
import { todayLabel } from '../../lib/today'
import { BoardAddRow, GlassPanel, PanelAddButton, PanelNote } from './GlassPanel'

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

function CalendarCardBase({ isVisible = true }: { isVisible?: boolean }) {
  const { data, ready, status, update } = useCavenStore()
  const events = data.calendar
  const [adding, setAdding] = useState(false)
  const dateLabel = useMemo(() => todayLabel(), [])

  const add = ({ title, time }: { title: string; time: string }) => {
    const event: CalendarEvent = {
      id: crypto.randomUUID(),
      title,
      time: time || 'All day',
      kind: 'event',
    }
    void update(prev => ({ ...prev, calendar: [event, ...prev.calendar] }))
  }

  // Highlight whatever is next on the clock today; nothing is highlighted if the
  // times can't be read or the day is already behind us.
  const activeId = useMemo(() => {
    const now = new Date().getHours() * 60 + new Date().getMinutes()
    let best: { id: string; at: number } | null = null
    for (const event of events) {
      const at = minutesOf(event.time)
      if (at === null || at < now) continue
      if (!best || at < best.at) best = { id: event.id, at }
    }
    return best?.id ?? null
  }, [events])

  return (
    <GlassPanel
      label="Today Calendar"
      title={dateLabel}
      isVisible={isVisible}
      headerRelative
      headerAction={<PanelAddButton active={adding} onClick={() => setAdding(v => !v)} />}
    >
      <div className="space-y-3">
        {adding && (
          <BoardAddRow
            placeholder="Add an event…"
            withTime
            onAdd={add}
            onClose={() => setAdding(false)}
          />
        )}
        {!ready ? (
          <PanelNote>{status}</PanelNote>
        ) : events.length === 0 ? (
          <PanelNote>Nothing in the diary for today.</PanelNote>
        ) : (
          events.map(event => (
            <div className="event-row" key={event.id}>
              <time className={event.id === activeId ? 'text-cyan-200' : ''}>{event.time}</time>
              <span className="event-line">
                <b>{event.title}</b>
                <small>{KIND_LABEL[event.kind] ?? 'Event'}</small>
              </span>
            </div>
          ))
        )}
      </div>
    </GlassPanel>
  )
}

// Memoised: useCaven() streams amplitude from App, and without this every
// frame of CAVEN speaking re-rendered this component for no reason.
export const CalendarCard = memo(CalendarCardBase)
