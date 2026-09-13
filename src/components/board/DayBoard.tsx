import { memo, useMemo, useState } from 'react'
import type { Task } from '../../lib/mockData'
import { useCavenStore } from '../../lib/store'
import { clockLabel, dayKey, dayLabel, parseStamp } from '../../../shared/when'

// The board, as one line you can open.
//
// Four glass panels sat on screen at all times, whether or not there was
// anything in them — four empty cards is a worse answer than no cards. This is
// the whole board in a single row: the one thing that matters next, and a count
// of what else there is. Open it and you get the day laid out hour by hour,
// empty hours included, because an empty afternoon is information too.

type Slot = {
  /** Minutes past midnight, for ordering and for finding its hour. */
  at: number
  time: string
  label: string
  kind: 'task' | 'event' | 'reminder'
  id: string
  overdue?: boolean
  task?: Task
}

/** "6:00 pm", "18:00", "9am" → minutes past midnight. null when unreadable. */
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

const HOUR_FMT = new Intl.DateTimeFormat('en-AU', { hour: 'numeric' })
const hourLabel = (h: number) => HOUR_FMT.format(new Date(2026, 0, 1, h, 0))

// `open` is owned by App, which needs to know: an expanded board must not be
// taken away by the stand-down timer while someone is reading it.
// `alwaysOpen` is Mission Control, where the board is the point of the page —
// no summary line to press, because you are already looking at it.
type Props = { open: boolean; onOpenChange: (open: boolean) => void; alwaysOpen?: boolean }

function DayBoardBase({ open, onOpenChange, alwaysOpen = false }: Props) {
  const { data, ready, update, remove } = useCavenStore()
  const [pending, setPending] = useState<Record<string, boolean>>({})

  const { timed, anytime, headline, extra } = useMemo(() => {
    const now = new Date()
    const today = dayKey(now)
    const minutesNow = now.getHours() * 60 + now.getMinutes()
    const timed: Slot[] = []
    const anytime: Slot[] = []

    // Events: today's only. Rows written before events carried a date have no
    // `at`, and every one of those was saved as today.
    for (const event of data.calendar) {
      const at = parseStamp(event.at)
      if (at && dayKey(at) !== today) continue
      const mins = minutesOf(event.time)
      const slot: Slot = { at: mins ?? 0, time: event.time, label: event.title, kind: 'event', id: `e:${event.id}` }
      if (mins === null) anytime.push(slot)
      else timed.push(slot)
    }

    // Reminders: today's sit in the day; anything else is listed with its day so
    // it doesn't masquerade as something happening this afternoon.
    for (const reminder of data.reminders) {
      const due = parseStamp(reminder.dueAt)
      const mins = due ? due.getHours() * 60 + due.getMinutes() : minutesOf(reminder.time)
      const isToday = due ? dayKey(due) === today : true
      const overdue = Boolean(due && due.getTime() < now.getTime())
      const slot: Slot = {
        at: mins ?? 0,
        time: due ? clockLabel(due) : reminder.time,
        label: due && !isToday ? `${reminder.title} · ${dayLabel(due, now)}` : reminder.title,
        kind: 'reminder',
        id: `r:${reminder.id}`,
        overdue,
      }
      if (isToday && mins !== null) timed.push(slot)
      else anytime.push(slot)
    }

    // Open tasks. One with a time joins the day; the rest are simply owed.
    for (const task of data.tasks) {
      if (task.done) continue
      const mins = task.time ? minutesOf(task.time) : null
      const slot: Slot = {
        at: mins ?? 0,
        time: task.time ?? '',
        label: task.title,
        kind: 'task',
        id: `t:${task.id}`,
        task,
      }
      if (mins === null) anytime.push(slot)
      else timed.push(slot)
    }

    timed.sort((a, b) => a.at - b.at)

    // What to put on the one line: something already late first, then the next
    // thing on the clock, then whatever is simply owed.
    const headline =
      timed.find((s) => s.overdue) ??
      timed.find((s) => s.at >= minutesNow) ??
      anytime[0] ??
      timed[0] ??
      null
    const extra = timed.length + anytime.length - (headline ? 1 : 0)

    return { timed, anytime, headline, extra }
  }, [data.calendar, data.reminders, data.tasks])

  // On the Caven screen there is nothing to show when nothing is owed. On
  // Mission Control the page still has to render — an empty day is an answer.
  if (!ready) return null
  if (!headline && !alwaysOpen) return null

  const toggleTask = (task: Task) => {
    const next = !(pending[task.id] ?? task.done)
    setPending((prev) => ({ ...prev, [task.id]: next }))
    const settle = () =>
      setPending((prev) => {
        if (!(task.id in prev)) return prev
        const { [task.id]: _gone, ...rest } = prev
        return rest
      })
    void update((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === task.id ? { ...t, done: next } : t)),
    })).then(settle, settle)
  }

  // Which collection a slot came from. The id carries the prefix so the row can
  // be put back where it belongs without threading the source through Slot.
  const COLLECTION = { task: 'tasks', event: 'calendar', reminder: 'reminders' } as const

  /** Only on Mission Control: the glanceable board on the Caven screen stays
   *  uncluttered, but the page you open in order to *look* is also the page you
   *  need in order to tidy — an event had no other way off the board at all. */
  const removeControl = (slot: Slot) =>
    alwaysOpen ? (
      <button
        type="button"
        className="day-remove"
        aria-label={`Remove ${slot.label}`}
        title={`Remove ${slot.label}`}
        onClick={() => void remove(COLLECTION[slot.kind], { id: slot.id.slice(2) })}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    ) : null

  const row = (slot: Slot) => {
    const done = slot.task ? (pending[slot.task.id] ?? slot.task.done) : false
    const body = (
      <>
        {slot.task && <span className={`day-tick${done ? ' is-done' : ''}`}>{done && '✓'}</span>}
        <span className={`day-label${done ? ' is-done' : ''}`}>{slot.label}</span>
      </>
    )
    if (!slot.task) {
      return (
        <span key={slot.id} className={`day-item day-item--${slot.kind}${slot.overdue ? ' is-overdue' : ''}`}>
          {body}
          {removeControl(slot)}
        </span>
      )
    }
    return (
      <span key={slot.id} className="day-item-wrap">
        <button
          type="button"
          className={`day-item day-item--task${slot.overdue ? ' is-overdue' : ''}`}
          onClick={() => toggleTask(slot.task as Task)}
          aria-pressed={done}
        >
          {body}
        </button>
        {removeControl(slot)}
      </span>
    )
  }

  // The hours to draw. Bounded by what is actually on the day, widened to a
  // recognisable working span so the shape of an empty afternoon is visible.
  const showing = open || alwaysOpen
  const hours: number[] = []
  if (showing) {
    const marks = timed.map((s) => Math.floor(s.at / 60))
    const from = Math.min(8, ...marks)
    const to = Math.max(20, ...marks)
    for (let h = from; h <= to; h++) hours.push(h)
  }

  return (
    <section className={`day-board${showing ? ' is-open' : ''}${alwaysOpen ? ' is-plain' : ''}`} aria-label="Your board">
      {!alwaysOpen && headline && (
        <button
          type="button"
          className="day-line"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
        >
          <span className={`day-line-key${headline.overdue ? ' is-overdue' : ''}`}>
            {headline.overdue ? 'DUE' : headline.time ? 'NEXT' : 'NOW'}
          </span>
          <span className="day-line-label">{headline.label}</span>
          {headline.time && <span className="day-line-time">{headline.time}</span>}
          {extra > 0 && <span className="day-line-more">+{extra}</span>}
          <span className="day-line-chev" aria-hidden="true">
            {open ? '▴' : '▾'}
          </span>
        </button>
      )}

      {showing && (
        <div className="day-open">
          <div className="day-hours">
            {hours.map((h) => {
              const items = timed.filter((s) => Math.floor(s.at / 60) === h)
              return (
                <div className={`day-hour${items.length ? '' : ' is-empty'}`} key={h}>
                  <span className="day-hour-key">{hourLabel(h)}</span>
                  <span className="day-hour-items">{items.map(row)}</span>
                </div>
              )
            })}
          </div>
          {anytime.length > 0 && (
            <div className="day-anytime">
              <span className="day-hour-key">Anytime</span>
              <span className="day-hour-items">{anytime.map(row)}</span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// Memoised: useCaven() streams amplitude from App, and without this every frame
// of CAVEN speaking would re-render the board for no reason.
export const DayBoard = memo(DayBoardBase)
