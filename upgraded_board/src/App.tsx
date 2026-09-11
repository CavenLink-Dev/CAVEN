import { CavenCore } from "./components/CavenCore/CavenCore"
import { CalendarCard } from "./components/board/CalendarCard"
import { DailyOverviewCard } from "./components/board/DailyOverviewCard"
import { RemindersCard } from "./components/board/RemindersCard"
import { TasksCard } from "./components/board/TasksCard"
import { TopBar } from "./components/board/TopBar"
import { CoreProvider } from "./lib/coreState"

export default function App() {
  return (
    <CoreProvider>
      <main className="app-shell">
        <TopBar />
        <div className="board-grid">
          <div className="board-left">
            <DailyOverviewCard />
            <TasksCard />
          </div>
          <CavenCore />
          <div className="board-right">
            <CalendarCard />
            <RemindersCard />
          </div>
        </div>
      </main>
    </CoreProvider>
  )
}
