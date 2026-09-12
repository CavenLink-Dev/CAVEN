import type React from 'react';
import { useMemo } from 'react';
import { useCavenStore } from '../../lib/store';
import { dayLabel, monthKey, parseStamp } from '../../../shared/when';
import { Bar, Panel, Ring, Row } from '../widgets';

/** Same quiet, in-character note the board cards use, so an empty page reads
 *  as "nothing here yet" rather than as something that failed to load. */
function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="t-caption" style={{ color: 'var(--caven-steel)' }}>{children}</p>;
}

function money(n: number) {
  return `${n < 0 ? '-' : '+'}$${Math.abs(n).toFixed(2)}`;
}

const MONTH_FMT = new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' });

export function FinancePage() {
  const { data } = useCavenStore();
  const { budgets, transactions } = data;

  // The heading said "this month" while the figure summed every transaction ever
  // recorded. It is the month now. Rows written before transactions carried an
  // ISO stamp fall back to their printed en-AU date rather than being dropped.
  const { balance, month, counted } = useMemo(() => {
    const now = new Date();
    const key = monthKey(now);
    const inMonth = transactions.filter((t) => {
      const at = parseStamp(t.at ?? t.when);
      return at ? monthKey(at) === key : false;
    });
    return {
      balance: inMonth.reduce((sum, t) => sum + t.amount, 0),
      month: MONTH_FMT.format(now),
      counted: inMonth.length,
    };
  }, [transactions]);

  return (
    <div className="w-full max-w-md space-y-3">
      <Panel>
        <div className="t-micro tracking-[0.28em]" style={{ color: 'var(--caven-steel)' }}>BALANCE THIS MONTH</div>
        <div className="font-display text-4xl" style={{ color: 'var(--caven-cyan-bright)', textShadow: '0 0 18px var(--caven-glow)' }}>
          ${balance.toFixed(2)}
        </div>
        <div className="mt-1 t-caption" style={{ color: 'var(--caven-steel)' }}>
          {counted === 0
            ? `Nothing recorded in ${month}.`
            : `${month} · ${counted} ${counted === 1 ? 'entry' : 'entries'}`}
        </div>
      </Panel>
      <Panel title="Budgets">
        <div className="space-y-3">
          {budgets.length === 0 && <EmptyNote>No budgets set. Tell me a category and a limit whenever you like.</EmptyNote>}
          {budgets.map((b) => (
            <div key={b.id}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{b.category}</span>
                <span className="opacity-70">${b.spent} / ${b.limit}</span>
              </div>
              <Bar value={(b.spent / b.limit) * 100} />
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Recent activity">
        {transactions.length === 0 && <EmptyNote>Nothing recorded yet. Say what you spent and I'll log it.</EmptyNote>}
        {transactions.map((x) => (
          <Row key={x.id}>
            <span className="flex-1">{x.label}</span>
            <span className="text-xs opacity-60">{x.when}</span>
            <span className="font-display text-sm" style={{ color: x.amount > 0 ? 'var(--caven-cyan-bright)' : 'var(--caven-steel-light)' }}>
              {money(x.amount)}
            </span>
          </Row>
        ))}
      </Panel>
    </div>
  );
}

export function JournalPage() {
  const { data } = useCavenStore();
  const { journal } = data;
  return (
    <div className="w-full max-w-md space-y-3">
      <Panel>
        <div className="t-micro tracking-[0.28em]" style={{ color: 'var(--caven-steel)' }}>JOURNAL</div>
        <div className="mt-1 text-sm opacity-80">Say “journal” and tell me how today felt — I'll write it here.</div>
      </Panel>
      {journal.length === 0 && (
        <Panel>
          <EmptyNote>No entries yet. The first one is always the hardest.</EmptyNote>
        </Panel>
      )}
      {journal.map((j) => (
        <Panel key={j.id}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{j.mood}</span>
            <span className="font-medium">{j.title}</span>
            <span className="ml-auto t-micro tracking-widest" style={{ color: 'var(--caven-steel)' }}>{j.date}</span>
          </div>
          <div className="mt-1.5 text-sm opacity-80">{j.body}</div>
        </Panel>
      ))}
    </div>
  );
}

export function BrainPage() {
  const { data } = useCavenStore();
  const { brainMetrics, brainNotes, interests, voiceNotes } = data;
  return (
    <div className="w-full max-w-md space-y-3">
      <Panel>
        <div className="t-micro tracking-[0.28em]" style={{ color: 'var(--caven-steel)' }}>CAVEN BRAIN</div>
        <div className="mt-1 text-sm opacity-80">What I've learned about you to answer better and support your goals.</div>
      </Panel>
      <Panel title="Wellbeing">
        <div className="grid grid-cols-2 gap-3">
          {brainMetrics.length === 0 && <EmptyNote>Nothing tracked yet.</EmptyNote>}
          {brainMetrics.map((m) => (
            <div key={m.label} className="flex items-center gap-2">
              <Ring value={m.value} label={`${m.value}`} />
              <div>
                <div className="text-sm">{m.label}</div>
                <div className="t-micro opacity-60">{m.hint}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Interests & hobbies">
        <div className="flex flex-wrap gap-1.5">
          {interests.length === 0 && <EmptyNote>Tell me what you enjoy and I'll remember it.</EmptyNote>}
          {interests.map((i) => (
            <span key={i} className="rounded-full px-2.5 py-1 text-xs" style={{ background: 'rgba(63,208,255,0.1)', border: '1px solid rgba(63,208,255,0.2)' }}>
              {i}
            </span>
          ))}
        </div>
      </Panel>
      {/* Notes had nowhere at all to live: CAVEN would take one, confirm it, and
          then there was no screen in the app that showed it back. */}
      <Panel title="Notes">
        {voiceNotes.length === 0 && <EmptyNote>No notes kept. Say “make a note” and I'll hold on to it.</EmptyNote>}
        {voiceNotes.map((n) => {
          const at = parseStamp(n.at ?? n.when);
          return (
            <Row key={n.id}>
              <span className="flex-1">{n.text}</span>
              <span className="text-xs opacity-60">{at ? dayLabel(at, new Date()) : n.when}</span>
            </Row>
          );
        })}
      </Panel>
      <Panel title="What I've learned">
        <ul className="space-y-2 text-sm opacity-85">
          {brainNotes.length === 0 && <li><EmptyNote>Nothing noted yet. I learn as we go.</EmptyNote></li>}
          {brainNotes.map((n) => (
            <li key={n} className="flex gap-2">
              <span style={{ color: 'var(--caven-cyan)' }}>▸</span>
              {n}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
