import { useMemo, useState } from 'react'
import type { Task } from '../../lib/mockData'
import { useCavenStore } from '../../lib/store'
import { DayBoard } from '../board/DayBoard'
import { dayLabel, monthKey, parseStamp } from '../../../shared/when'

// Mission Control — everything he is carrying, in one place.
//
// The Caven screen is for talking; this is for looking. It is where the board
// went when it stopped being permanent furniture around the orb, and where money
// lives now that Finance is a section rather than a page of its own.

const MONTH_FMT = new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' })
const money = (n: number) => `${n < 0 ? '-' : '+'}$${Math.abs(n).toFixed(2)}`

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mc-section" id={id}>
      <div className="mc-head">
        <h2 className="mc-title">{title}</h2>
        {note && <span className="mc-note">{note}</span>}
      </div>
      {children}
    </section>
  )
}

/** Takes a row off the board. Paired with the Undo strip below, so a mis-tap is
 *  one click back rather than a spoken command. */
function Remove({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" className="mc-remove" onClick={onRemove} aria-label={`Remove ${label}`} title={`Remove ${label}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mc-empty">{children}</p>
}

export function MissionControl() {
  const { data, update, remove, undo } = useCavenStore()
  const [pending, setPending] = useState<Record<string, boolean>>({})

  const open = data.tasks.filter((t) => !(pending[t.id] ?? t.done))
  const done = data.tasks.filter((t) => pending[t.id] ?? t.done)

  const toggle = (task: Task) => {
    const next = !(pending[task.id] ?? task.done)
    setPending((prev) => ({ ...prev, [task.id]: next }))
    const settle = () =>
      setPending((prev) => {
        if (!(task.id in prev)) return prev
        const { [task.id]: _gone, ...rest } = prev
        return rest
      })
    void update((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === task.id ? { ...t, done: next } : t)),
    })).then(settle, settle)
  }

  const reminders = useMemo(() => {
    const now = new Date()
    return data.reminders
      .map((r) => ({ r, at: parseStamp(r.dueAt) }))
      .sort((a, b) => (a.at?.getTime() ?? Infinity) - (b.at?.getTime() ?? Infinity))
      .map(({ r, at }) => ({
        ...r,
        when: at ? `${dayLabel(at, now)} · ${r.time}` : [r.date, r.time].filter(Boolean).join(' · '),
        overdue: Boolean(at && at.getTime() < now.getTime()),
      }))
  }, [data.reminders])

  // Money is this month's, not everything ever — the heading says "this month"
  // and for a long time the figure did not agree with it.
  const { balance, month, counted } = useMemo(() => {
    const now = new Date()
    const key = monthKey(now)
    const inMonth = data.transactions.filter((t) => {
      const at = parseStamp(t.at ?? t.when)
      return at ? monthKey(at) === key : false
    })
    return {
      balance: inMonth.reduce((sum, t) => sum + t.amount, 0),
      month: MONTH_FMT.format(now),
      counted: inMonth.length,
    }
  }, [data.transactions])

  const undone = data.lastDeleted
  const undoneLabel =
    (undone?.row as { title?: string; name?: string } | undefined)?.title ??
    (undone?.row as { title?: string; name?: string } | undefined)?.name ??
    'That'

  return (
    <div className="mc">
      {undone && (
        <div className="mc-undo" role="status">
          <span>{undoneLabel} removed.</span>
          <button type="button" onClick={() => void undo()}>Undo</button>
        </div>
      )}
      <Section id="today" title="Today">
        {/* Always open here. On the Caven screen the same board is a single line
            that stands down; this is the page you came to in order to look. */}
        <DayBoard open onOpenChange={() => {}} alwaysOpen />
      </Section>

      <Section id="tasks" title="Tasks" note={open.length ? `${open.length} open` : undefined}>
        {data.tasks.length === 0 ? (
          <Empty>Nothing on the list. Say the word and I'll add one.</Empty>
        ) : (
          <div className="mc-rows">
            {open.map((task) => (
              <div className="mc-line" key={task.id}>
                <button type="button" className="mc-task" onClick={() => toggle(task)} aria-pressed={false}>
                  <span className="day-tick" />
                  <span className="day-label">{task.title}</span>
                  {task.time && <span className="mc-when">{task.time}</span>}
                </button>
                <Remove label={task.title} onRemove={() => void remove('tasks', task)} />
              </div>
            ))}
            {done.map((task) => (
              <div className="mc-line" key={task.id}>
                <button type="button" className="mc-task" onClick={() => toggle(task)} aria-pressed>
                  <span className="day-tick is-done">✓</span>
                  <span className="day-label is-done">{task.title}</span>
                </button>
                <Remove label={task.title} onRemove={() => void remove('tasks', task)} />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section id="reminders" title="Reminders" note={reminders.length ? `${reminders.length}` : undefined}>
        {reminders.length === 0 ? (
          <Empty>None armed. I'll hold one for you whenever you like.</Empty>
        ) : (
          <div className="mc-rows">
            {reminders.map((r) => (
              <div className={`mc-row${r.overdue ? ' is-overdue' : ''}`} key={r.id}>
                <span className="day-label">{r.title}</span>
                <span className="mc-when">
                  {r.when}
                  {r.repeat ? ` · repeats ${r.repeat}` : ''}
                </span>
                <Remove label={r.title} onRemove={() => void remove('reminders', r)} />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section id="money" title="Money" note={`${month}${counted ? ` · ${counted}` : ''}`}>
        <div className="mc-balance">${balance.toFixed(2)}</div>
        {counted === 0 && <Empty>Nothing recorded in {month}. Say what you spent and I'll log it.</Empty>}

        {data.budgets.length > 0 && (
          <div className="mc-rows mc-budgets">
            {data.budgets.map((b) => (
              <div key={b.id}>
                <div className="mc-row">
                  <span className="day-label">{b.category}</span>
                  <span className="mc-when">${b.spent} / ${b.limit}</span>
                </div>
                <span className="mc-bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (b.spent / b.limit) * 100)}%` }} />
                </span>
              </div>
            ))}
          </div>
        )}

        {data.transactions.length > 0 && (
          <div className="mc-rows">
            {data.transactions.slice(0, 8).map((t) => (
              <div className="mc-row" key={t.id}>
                <span className="day-label">{t.label}</span>
                <span className="mc-when">{t.when}</span>
                <span className={`mc-amount${t.amount > 0 ? ' is-in' : ''}`}>{money(t.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
