import { memo, useMemo } from 'react'
import { useCavenStore } from '../../lib/store'
import { todayLabel } from '../../lib/today'
import { dayLabel, parseStamp, repeatLabel } from '../../../shared/when'
import { GlassPanel, PanelNote } from './GlassPanel'

function RemindersCardBase({ isVisible = true }: { isVisible?: boolean }) {
  const { data, ready, status, loadFailed, reload } = useCavenStore()
  const dateLabel = useMemo(() => todayLabel(), [])

  // Soonest first where a due time was captured; anything undated keeps its place at the back.
  const ordered = useMemo(() => {
    return data.reminders
      .map((reminder, index) => {
        const ms = reminder.dueAt ? Date.parse(reminder.dueAt) : Number.NaN
        return { reminder, at: Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms, index }
      })
      .sort((a, b) => a.at - b.at || a.index - b.index)
      .map(entry => entry.reminder)
  }, [data.reminders])

  return (
    <GlassPanel
      label="Reminders"
      title={dateLabel}
      isVisible={isVisible}
      headerRelative
    >
      <div className="space-y-3 board-list-scroll">
        {!ready ? (
          <PanelNote onRetry={loadFailed ? reload : undefined}>{status}</PanelNote>
        ) : ordered.length === 0 ? (
          <PanelNote>No reminders armed. I'll hold one for you whenever you like.</PanelNote>
        ) : (
          ordered.map(reminder => {
            const due = parseStamp(reminder.dueAt)
            const now = new Date()
            // "12/09/2026" reads as a database row; "tomorrow" reads as a plan.
            // A repeating one says so, or the board would look like it forgot.
            const when = due ? dayLabel(due, now) : reminder.date
            const overdue = Boolean(due && due.getTime() < now.getTime())
            const note = [
              when,
              reminder.repeat ? repeatLabel(reminder.repeat, due ?? undefined) : '',
              reminder.note,
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <div className="flex gap-3" key={reminder.id}>
                <span className={`w-[52px] shrink-0 t-meta ${overdue ? 'text-amber-200/80' : 'text-cyan-100/60'}`}>
                  {reminder.time}
                </span>
                <span>
                  <b className="block t-title text-white/90">{reminder.title}</b>
                  {note && <small className="t-caption text-white/45">{note}</small>}
                </span>
              </div>
            )
          })
        )}
      </div>
    </GlassPanel>
  )
}

// Memoised: useCaven() streams amplitude from App, and without this every
// frame of CAVEN speaking re-rendered this component for no reason.
export const RemindersCard = memo(RemindersCardBase)
