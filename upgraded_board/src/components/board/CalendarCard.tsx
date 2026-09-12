import { useCore } from "../../lib/coreState"
import { calendar } from "../../lib/mockData"
import { GlassPanel } from "./GlassPanel"

export function CalendarCard() {
  const { activeModules } = useCore()
  return (
    <GlassPanel
      label="Today Calendar"
      title="A decent amount of daylight"
      isVisible={activeModules.calendar}
      largeLabel
      showTitle={false}
      headerRelative
    >
      <div className="space-y-3">
        {calendar.map((event) => (
          <div className="event-row" key={event.time}>
            <time className={event.active ? "text-cyan-200" : ""}>
              {event.time}
            </time>
            <span className="event-line">
              <b>{event.title}</b>
              <small>{event.meta}</small>
            </span>
          </div>
        ))}
      </div>
    </GlassPanel>
  )
}
