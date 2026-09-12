import type React from 'react';
import { useCavenStore } from '../../lib/store';
import { Bar, Panel, Ring, Row } from '../widgets';

/** Same quiet, in-character note the board cards use, so an empty page reads
 *  as "nothing here yet" rather than as something that failed to load. */
function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="t-caption" style={{ color: 'var(--caven-steel)' }}>{children}</p>;
}

function money(n: number) {
  return `${n < 0 ? '-' : '+'}$${Math.abs(n).toFixed(2)}`;
}

export function FinancePage() {
  const { data } = useCavenStore();
  const { budgets, transactions } = data;
  const balance = transactions.reduce((s, t) => s + t.amount, 0);
  return (
    <div className="w-full max-w-md space-y-3">
      <Panel>
        <div className="t-micro tracking-[0.28em]" style={{ color: 'var(--caven-steel)' }}>BALANCE THIS MONTH</div>
        <div className="font-display text-4xl" style={{ color: 'var(--caven-cyan-bright)', textShadow: '0 0 18px var(--caven-glow)' }}>
          ${balance.toFixed(2)}
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
  const { brainMetrics, brainNotes, interests } = data;
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
