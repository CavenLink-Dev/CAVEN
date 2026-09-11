import type { CardKind } from '../../lib/cavenState';
import { useCavenStore } from '../../lib/store';
import { Bar, Dot, Ring, Row } from '../widgets';

function money(n: number) {
  return `${n < 0 ? '-' : '+'}$${Math.abs(n).toFixed(2)}`;
}

export function CardContent({ kind }: { kind: CardKind }) {
  const { data } = useCavenStore();
  const {
    brainMetrics,
    brainNotes,
    budgets,
    calendar,
    habits,
    interests,
    journal,
    reminders,
    tasks,
    transactions,
    voiceNotes,
  } = data;
  switch (kind) {
    case 'reminder': {
      const r = reminders[0];
      if (!r) return <div className="text-sm opacity-70">No reminders yet — say “remind me…” and I’ll keep it.</div>;
      return (
        <div className="space-y-3">
          <div className="text-lg font-semibold" style={{ color: 'var(--caven-cyan-bright)' }}>
            {r.title}
          </div>
          <div className="flex gap-6">
            <div>
              <div className="text-[10px] tracking-widest" style={{ color: 'var(--caven-steel)' }}>DATE</div>
              <div className="font-display">{r.date}</div>
            </div>
            <div>
              <div className="text-[10px] tracking-widest" style={{ color: 'var(--caven-steel)' }}>TIME</div>
              <div className="font-display">{r.time}</div>
            </div>
          </div>
          {r.note && <div className="text-sm opacity-80">{r.note}</div>}
          <div className="mt-2 rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(63,208,255,0.08)' }}>
            Saved on your board.
          </div>
        </div>
      );
    }
    case 'tasks':
      return (
        <div>
          {tasks.map((t) => (
            <Row key={t.id}>
              <Dot done={t.done} />
              <span className={`flex-1 ${t.done ? 'line-through opacity-50' : ''}`}>{t.title}</span>
              {t.tag && (
                <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: 'rgba(138,149,165,0.18)' }}>
                  {t.tag}
                </span>
              )}
            </Row>
          ))}
        </div>
      );
    case 'habits':
      return (
        <div className="space-y-3">
          {habits.map((h) => (
            <div key={h.id} className="flex items-center gap-3">
              <Ring value={Math.round((h.streak / h.goal) * 100)} label={String(h.streak)} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span>{h.icon}</span>
                  <span className="font-medium">{h.name}</span>
                </div>
                <div className="text-xs opacity-60">
                  {h.streak}-day streak · goal {h.goal}
                </div>
              </div>
              <Dot done={h.done} />
            </div>
          ))}
        </div>
      );
    case 'calendar':
      return (
        <div>
          {calendar.map((e) => (
            <Row key={e.id}>
              <span className="font-display text-sm" style={{ color: 'var(--caven-cyan)' }}>{e.time}</span>
              <span className="flex-1">{e.title}</span>
              <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: 'rgba(63,208,255,0.1)' }}>
                {e.kind}
              </span>
            </Row>
          ))}
        </div>
      );
    case 'voicenote':
      return (
        <div className="space-y-3">
          {voiceNotes.map((v) => (
            <div key={v.id} className="rounded-xl p-3" style={{ background: 'rgba(138,149,165,0.08)' }}>
              <div className="text-sm">{v.text}</div>
              <div className="mt-1 text-[10px] tracking-widest" style={{ color: 'var(--caven-steel)' }}>{v.when}</div>
            </div>
          ))}
        </div>
      );
    case 'finance':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {budgets.map((b) => (
              <div key={b.id}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{b.category}</span>
                  <span className="opacity-70">${b.spent}/{b.limit}</span>
                </div>
                <Bar value={(b.spent / b.limit) * 100} />
              </div>
            ))}
          </div>
          <div>
            <div className="mb-1.5 font-display text-[10px] tracking-[0.28em]" style={{ color: 'var(--caven-steel)' }}>
              RECENT
            </div>
            {transactions.map((x) => (
              <Row key={x.id}>
                <span className="flex-1">{x.label}</span>
                <span className="text-xs opacity-60">{x.when}</span>
                <span
                  className="font-display text-sm"
                  style={{ color: x.amount > 0 ? 'var(--caven-cyan-bright)' : 'var(--caven-steel-light)' }}
                >
                  {money(x.amount)}
                </span>
              </Row>
            ))}
          </div>
        </div>
      );
    case 'journal':
      return (
        <div className="space-y-3">
          {journal.map((j) => (
            <div key={j.id} className="rounded-xl p-3" style={{ background: 'rgba(138,149,165,0.08)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{j.mood}</span>
                <span className="font-medium">{j.title}</span>
                <span className="ml-auto text-[10px] tracking-widest" style={{ color: 'var(--caven-steel)' }}>{j.date}</span>
              </div>
              <div className="mt-1.5 text-sm opacity-80">{j.body}</div>
            </div>
          ))}
        </div>
      );
    case 'brain':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {brainMetrics.map((m) => (
              <div key={m.label} className="flex items-center gap-2">
                <Ring value={m.value} label={`${m.value}`} />
                <div>
                  <div className="text-sm">{m.label}</div>
                  <div className="text-[10px] opacity-60">{m.hint}</div>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-1.5 font-display text-[10px] tracking-[0.28em]" style={{ color: 'var(--caven-steel)' }}>INTERESTS</div>
            <div className="flex flex-wrap gap-1.5">
              {interests.map((i) => (
                <span key={i} className="rounded-full px-2.5 py-1 text-xs" style={{ background: 'rgba(63,208,255,0.1)', border: '1px solid rgba(63,208,255,0.2)' }}>
                  {i}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 font-display text-[10px] tracking-[0.28em]" style={{ color: 'var(--caven-steel)' }}>WHAT I'VE LEARNED</div>
            <ul className="space-y-1.5 text-sm opacity-80">
              {brainNotes.map((n) => (
                <li key={n} className="flex gap-2">
                  <span style={{ color: 'var(--caven-cyan)' }}>▸</span>
                  {n}
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
  }
}
