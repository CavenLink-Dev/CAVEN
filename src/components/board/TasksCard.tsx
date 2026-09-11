import { useState } from 'react'
import type { Task } from '../../lib/mockData'
import { useCavenStore } from '../../lib/store'
import { GlassPanel, PanelNote } from './GlassPanel'

const detailOf = (task: Task) => [task.time, task.tag].filter(Boolean).join(' · ')

export function TasksCard({ isVisible = true }: { isVisible?: boolean }) {
  const { data, ready, status, update } = useCavenStore()
  // Optimistic overlay: the tick flips at once, then clears when the save settles.
  // A failed save simply leaves the stored value showing, so nothing is ever faked.
  const [pending, setPending] = useState<Record<string, boolean>>({})

  const toggle = (task: Task) => {
    const nextDone = !(pending[task.id] ?? task.done)
    setPending(prev => ({ ...prev, [task.id]: nextDone }))
    const settle = () =>
      setPending(prev => {
        if (!(task.id in prev)) return prev
        const next = { ...prev }
        delete next[task.id]
        return next
      })
    void update(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => (t.id === task.id ? { ...t, done: nextDone } : t)),
    })).then(settle, settle)
  }

  return (
    <GlassPanel
      label={<strong>Tasks</strong>}
      title="Small moves, real progress"
      isVisible={isVisible}
      largeLabel
      showTitle={false}
      headerRelative
    >
      <div className="space-y-1">
        {!ready ? (
          <PanelNote>{status}</PanelNote>
        ) : data.tasks.length === 0 ? (
          <PanelNote>No tasks on the list. Say the word and I'll add one.</PanelNote>
        ) : (
          data.tasks.map(task => {
            const complete = pending[task.id] ?? task.done
            const detail = detailOf(task)
            return (
              <button
                onClick={() => toggle(task)}
                className="task-item"
                key={task.id}
                aria-pressed={complete}
              >
                <span className={`task-check ${complete ? 'is-done' : ''}`}>{complete && '✓'}</span>
                <span className="min-w-0 text-left">
                  <span
                    className={`block text-[13px] ${complete ? 'text-white/35 line-through' : 'text-white/85'}`}
                  >
                    {task.title}
                  </span>
                  {detail && (
                    <span className="block truncate text-[11px] text-white/40 mt-0.5">{detail}</span>
                  )}
                </span>
              </button>
            )
          })
        )}
      </div>
    </GlassPanel>
  )
}
