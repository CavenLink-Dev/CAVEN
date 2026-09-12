import { useCore } from "../../lib/coreState"
import { GlassPanel } from "./GlassPanel"

export function DailyOverviewCard() {
  const { activeModules } = useCore()
  return (
    <GlassPanel
      label="Daily overview"
      title="A manageable Thursday"
      isVisible={activeModules.overview}
      largeLabel
      showTitle={false}
      headerRelative
    >
      <div className="space-y-4 text-[13px]">
        <div className="overview-row">
          <span className="overview-key text-cyan-200">Now</span>
          <p>
            Finish the tenancy email <b>· 25 min</b>
          </p>
        </div>
        <div className="overview-row">
          <span className="overview-key">Next</span>
          <p>Design catch-up at 10:30</p>
        </div>
        <div className="overview-row">
          <span className="overview-key">Later</span>
          <p>Water plants, if the plants insist.</p>
        </div>
      </div>
    </GlassPanel>
  )
}
