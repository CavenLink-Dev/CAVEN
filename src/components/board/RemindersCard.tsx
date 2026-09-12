import { memo, useMemo, useState } from 'react'
import type { Reminder } from '../../lib/mockData'
import { useCavenStore } from '../../lib/store'
import { todayLabel } from '../../lib/today'
import { BoardAddRow, GlassPanel, PanelAddButton, PanelNote } from './GlassPanel'

function RemindersCardBase({ isVisible = true }: { isVisible?: boolean }) {
  const { data, ready, status, update } = useCavenStore()
  const [adding, setAdding] = useState(false)
  const dateLabel = useMemo(() => todayLabel(), [])

  const add = ({ title, time }: { title: string; time: string }) => {
    const reminder: Reminder = { id: crypto.randomUUID(), title, date: '', time }
    void update(prev => ({ ...prev, reminders: [reminder, ...prev.reminders] }))
  }

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
      headerAction={<PanelAddButton active={adding} onClick={() => setAdding(v => !v)} />}
    >
      <div className="space-y-3">
        {adding && (
          <BoardAddRow
            placeholder="Add a reminder…"
            withTime
            onAdd={add}
            onClose={() => setAdding(false)}
          />
        )}
        {!ready ? (
          <PanelNote>{status}</PanelNote>
        ) : ordered.length === 0 ? (
          <PanelNote>No reminders armed. I'll hold one for you whenever you like.</PanelNote>
        ) : (
          ordered.map(reminder => {
            const note = [reminder.date, reminder.note].filter(Boolean).join(' · ')
            return (
              <div className="flex gap-3" key={reminder.id}>
                <span className="w-[52px] shrink-0 t-meta text-cyan-100/60">
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
