import { useCore } from '../../lib/coreState'
import { reminders } from '../../lib/mockData'
import { GlassPanel } from './GlassPanel'

export function RemindersCard() {
  const { activeModules } = useCore()
  return (
    <GlassPanel label="Reminders" title="Future you has cover" isVisible={activeModules.reminders} largeLabel showTitle={false} headerRelative>
      <div className="space-y-3">
        {reminders.map(reminder => (
          <div className="flex gap-3" key={reminder.title}>
            <span className="w-[58px] shrink-0 font-mono text-[10px] leading-5 text-cyan-100/65">
              {reminder.time}
            </span>
            <span>
              <b className="block text-[13px] font-medium text-white/82">{reminder.title}</b>
              <small className="text-[11px] text-white/40">{reminder.note}</small>
            </span>
          </div>
        ))}
      </div>
    </GlassPanel>
  )
}
