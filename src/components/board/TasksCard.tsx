import { memo, useMemo, useState } from 'react'
import type { Task } from '../../lib/mockData'
import { useCavenStore } from '../../lib/store'
import { todayLabel } from '../../lib/today'
import { GlassPanel, PanelNote } from './GlassPanel'

const detailOf = (task: Task) => [task.time, task.tag].filter(Boolean).join(' · ')

function TasksCardBase({ isVisible = true }: { isVisible?: boolean }) {
  const { data, ready, status, loadFailed, reload, update } = useCavenStore()
  // Optimistic overlay: the tick flips at once, then clears when the save settles.
  // A failed save simply leaves the stored value showing, so nothing is ever faked.
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [removing, setRemoving] = useState<Record<string, boolean>>({})
  const dateLabel = useMemo(() => todayLabel(), [])

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

  // Clearing a finished task keeps it in the undo slot, so the same spoken
  // "undo" that recovers a voice deletion recovers this one too.
  const remove = (task: Task) => {
    setRemoving(prev => ({ ...prev, [task.id]: true }))
    const settle = () =>
      setRemoving(prev => {
        if (!(task.id in prev)) return prev
        const next = { ...prev }
        delete next[task.id]
        return next
      })
    void update(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== task.id),
      lastDeleted: { kind: 'tasks', row: task },
    })).then(settle, settle)
  }

  return (
    <GlassPanel
      label={<strong>Tasks</strong>}
      title={dateLabel}
      isVisible={isVisible}
      headerRelative
    >
      <div className="space-y-1 board-list-scroll">
        {!ready ? (
          <PanelNote onRetry={loadFailed ? reload : undefined}>{status}</PanelNote>
        ) : data.tasks.length === 0 ? (
          <PanelNote>No tasks on the list. Say the word and I'll add one.</PanelNote>
        ) : (
          data.tasks.map(task => {
            const complete = pending[task.id] ?? task.done
            const detail = detailOf(task)
            return (
              <div className="task-row" key={task.id}>
                <button
                  onClick={() => toggle(task)}
                  className="task-item"
                  aria-pressed={complete}
                >
                  <span className={`task-check ${complete ? 'is-done' : ''}`}>{complete && '✓'}</span>
                  <span className="min-w-0 text-left">
                    <span
                      className={`block t-title ${complete ? 'text-white/35 line-through' : 'text-white/85'}`}
                    >
                      {task.title}
                    </span>
                    {detail && (
                      <span className="block truncate t-caption text-white/45 mt-0.5">{detail}</span>
                    )}
                  </span>
                </button>
                {complete && (
                  <button
                    type="button"
                    className="task-clear"
                    onClick={() => remove(task)}
                    disabled={removing[task.id]}
                    aria-label={`Remove ${task.title} from the list`}
                    title="Remove from the list"
                  >
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
                      <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
                    </svg>
                  </button>
                )}
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
export const TasksCard = memo(TasksCardBase)
