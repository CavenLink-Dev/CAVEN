import { useMemo } from 'react'
import { useCavenStore } from '../../lib/store'
import { GlassPanel, PanelNote } from './GlassPanel'

export function RemindersCard({ isVisible = true }: { isVisible?: boolean }) {
  const { data, ready, status } = useCavenStore()

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
      title="Future you has cover"
      isVisible={isVisible}
      largeLabel
      showTitle={false}
      headerRelative
    >
      <div className="space-y-3">
        {!ready ? (
          <PanelNote>{status}</PanelNote>
        ) : ordered.length === 0 ? (
          <PanelNote>No reminders armed. I'll hold one for you whenever you like.</PanelNote>
        ) : (
          ordered.map(reminder => {
            const note = [reminder.date, reminder.note].filter(Boolean).join(' · ')
            return (
              <div className="flex gap-3" key={reminder.id}>
                <span className="w-[58px] shrink-0 font-mono text-[10px] leading-5 text-cyan-100/65">
                  {reminder.time}
                </span>
                <span>
                  <b className="block text-[13px] font-medium text-white/82">{reminder.title}</b>
                  {note && <small className="text-[11px] text-white/40">{note}</small>}
                </span>
              </div>
            )
          })
        )}
      </div>
    </GlassPanel>
  )
}
