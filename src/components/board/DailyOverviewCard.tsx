import { memo, useMemo } from 'react'
import { useCavenStore } from '../../lib/store'
import { todayLabel } from '../../lib/today'
import { GlassPanel, PanelNote } from './GlassPanel'

type OverviewItem = { key: string; label: string; meta?: string }

const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ')

/** dueAt first, then stored order, so undated reminders keep their place at the back. */
function reminderOrder(dueAt: string | undefined, index: number): [number, number] {
  if (!dueAt) return [Number.MAX_SAFE_INTEGER, index]
  const ms = Date.parse(dueAt)
  return [Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms, index]
}

function DailyOverviewCardBase({ isVisible = true }: { isVisible?: boolean }) {
  const { data, ready, status, loadFailed, reload } = useCavenStore()
  const { tasks, calendar, reminders } = data
  const dateLabel = useMemo(() => todayLabel(), [])

  const [now, next, later] = useMemo(() => {
    const openTasks: OverviewItem[] = tasks
      .filter(task => !task.done)
      .map(task => ({ key: `task:${task.id}`, label: task.title, meta: join(task.time, task.tag) }))

    const events: OverviewItem[] = calendar.map(event => ({
      key: `event:${event.id}`,
      label: event.title,
      meta: event.time,
    }))

    const upcoming: OverviewItem[] = reminders
      .map((reminder, index) => ({ reminder, order: reminderOrder(reminder.dueAt, index) }))
      .sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1])
      .map(({ reminder }) => ({
        key: `reminder:${reminder.id}`,
        label: reminder.title,
        meta: join(reminder.date, reminder.time),
      }))

    // Same precedence as the RIGHT NOW widget — an open task first, then what is
    // actually scheduled — and then whatever is left over, in the same order.
    const queue = [
      openTasks[0],
      events[0],
      upcoming[0],
      ...openTasks.slice(1),
      ...events.slice(1),
      ...upcoming.slice(1),
    ].filter((item): item is OverviewItem => Boolean(item))

    return queue.slice(0, 3)
  }, [tasks, calendar, reminders])

  const rows: { slot: string; item: OverviewItem }[] = []
  if (now) rows.push({ slot: 'Now', item: now })
  if (next) rows.push({ slot: 'Next', item: next })
  if (later) rows.push({ slot: 'Later', item: later })

  return (
    <GlassPanel
      label="Daily overview"
      title={dateLabel}
      isVisible={isVisible}
      headerRelative
    >
      <div className="space-y-3 t-body board-list-scroll">
        {!ready ? (
          <PanelNote onRetry={loadFailed ? reload : undefined}>{status}</PanelNote>
        ) : rows.length === 0 ? (
          <PanelNote>Nothing on the board yet. The day is entirely yours.</PanelNote>
        ) : (
          rows.map(({ slot, item }) => (
            <div className="overview-row" key={item.key}>
              <span className={`overview-key${slot === 'Now' ? ' text-cyan-200' : ''}`}>{slot}</span>
              <p>
                {item.label}
                {item.meta && <b> · {item.meta}</b>}
              </p>
            </div>
          ))
        )}
      </div>
    </GlassPanel>
  )
}

// Memoised: useCaven() streams amplitude from App, and without this every
// frame of CAVEN speaking re-rendered this component for no reason.
export const DailyOverviewCard = memo(DailyOverviewCardBase)
