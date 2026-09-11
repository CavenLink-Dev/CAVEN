import { useState } from "react"
import { useCore } from "../../lib/coreState"
import { tasks } from "../../lib/mockData"
import { GlassPanel } from "./GlassPanel"

export function TasksCard() {
  const { activeModules } = useCore()
  const [done, setDone] = useState<string[]>(["t4"])
  return (
    <GlassPanel
      label={<strong>Tasks</strong>}
      title="Small moves, real progress"
      isVisible={activeModules.tasks}
      largeLabel
      showTitle={false}
      headerRelative
    >
      <div className="space-y-1">
        {tasks.map((task) => {
          const complete = done.includes(task.id)
          return (
            <button
              onClick={() =>
                setDone((v) =>
                  complete ? v.filter((id) => id !== task.id) : [...v, task.id],
                )
              }
              className="task-item"
              key={task.id}
            >
              <span className={`task-check ${complete ? "is-done" : ""}`}>
                {complete && "✓"}
              </span>
              <span className="min-w-0 text-left">
                <span
                  className={`block text-[13px] ${
                    complete ? "text-white/35 line-through" : "text-white/85"
                  }`}
                >
                  {task.title}
                </span>
                <span className="block truncate text-[11px] text-white/40 mt-0.5">
                  {task.detail}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </GlassPanel>
  )
}
