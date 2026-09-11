import { useCavenStore } from '../lib/store';
import { Bar, Dot, Ring } from './widgets';

export type Widget = { title: string; hint: string; body: React.ReactNode };

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2 font-display text-[10px] tracking-[0.26em]" style={{ color: 'var(--caven-steel)' }}>
    {children}
  </div>
);

// Neat cyan marker in place of emojis.
const M = () => <span style={{ color: 'var(--caven-cyan)' }}>▹</span>;

const L = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-sm">
    <M />
    <span className="truncate">{children}</span>
  </div>
);

// Curated to a focused ring around the plasma core — the panels that carry
// CAVEN's everyday value, JARVIS-HUD style. Niche/experimental cards were
// pruned to keep the orbit clean and readable.
export function useWidgets(): Widget[] {
  const { data } = useCavenStore();
  const { budgets, calendar, habits, tasks, transactions, voiceNotes } = data;
  return [
  {
    title: 'RIGHT NOW',
    hint: 'The next useful thing',
    body: (
      <div>
        <div className="text-lg font-semibold" style={{ color: 'var(--caven-cyan-bright)' }}>Refill your prescription</div>
        <div className="mt-1 text-sm opacity-75">Pharmacy closes at 6pm · 2 min call</div>
        <div className="mt-3 inline-flex rounded-full px-3 py-1 text-xs" style={{ background: 'rgba(63,208,255,0.15)', border: '1px solid rgba(63,208,255,0.4)' }}>Do it now</div>
      </div>
    ),
  },
  { title: 'REMINDERS', hint: 'Create · snooze · dismiss', body: (<div className="space-y-1"><L>Dinner with Mom — Sep 5, 6pm</L><L>Physio — Sep 8, 2:30pm</L></div>) },
  {
    title: "TODAY'S TIMELINE",
    hint: 'Appointments & free time',
    body: (
      <div>
        {calendar.slice(0, 4).map((e) => (
          <div key={e.id} className="mb-1 flex items-center gap-2 text-sm">
            <span className="font-display text-xs" style={{ color: 'var(--caven-cyan)' }}>{e.time}</span>
            <span className="truncate">{e.title}</span>
          </div>
        ))}
      </div>
    ),
  },
  { title: 'TIME TO LEAVE', hint: 'Prep + travel + departure', body: (<div><div className="font-display text-2xl" style={{ color: 'var(--caven-cyan-bright)' }}>17:20</div><div className="text-sm opacity-75">Leave for dinner · 18 min travel + 22 min prep</div></div>) },
  { title: 'TASKS', hint: 'Capture & choose what matters', body: (<div>{tasks.slice(0, 3).map((t) => (<div key={t.id} className="mb-1.5 flex items-center gap-2 text-sm"><Dot done={t.done} /><span className={`truncate ${t.done ? 'line-through opacity-50' : ''}`}>{t.title}</span></div>))}</div>) },
  { title: 'FOCUS TIMER', hint: 'Start · pause · break', body: (<div className="flex items-center gap-3"><Ring value={62} label="25:00" size={58} /><div className="text-xs opacity-75">Deep work<br />Tap to start / pause</div></div>) },
  { title: 'HABITS', hint: 'Gentle check-ins', body: (<div className="flex flex-wrap gap-3">{habits.slice(0, 4).map((h) => (<div key={h.id} className="flex flex-col items-center gap-1"><Ring value={Math.round((h.streak / h.goal) * 100)} label={`${h.streak}`} size={42} /><span className="text-[10px] opacity-70">{h.streak}d</span></div>))}</div>) },
  { title: 'FINANCE', hint: 'Spending, bills, savings', body: (<div className="space-y-2">{budgets.slice(0, 2).map((b) => (<div key={b.id}><div className="mb-1 flex justify-between text-xs"><span>{b.category}</span><span className="opacity-70">${b.spent}/{b.limit}</span></div><Bar value={(b.spent / b.limit) * 100} /></div>))}<div className="text-xs opacity-70">{transactions[0] ? `Latest: ${transactions[0].label} $${Math.abs(transactions[0].amount)}` : 'No transactions yet'}</div></div>) },
  { title: 'MOOD & ENERGY', hint: 'Check-in & adjust plan', body: (<div className="flex items-center gap-3"><Ring value={68} label="68" size={50} /><div className="text-xs opacity-75">Energy dips ~3pm<br />Plan a lighter afternoon</div></div>) },
  { title: 'VOICE NOTES', hint: 'Transcript + summary', body: (<div><div className="text-xs opacity-80">{voiceNotes[0]?.text ?? 'Say a note and I’ll keep it here.'}</div><div className="mt-1.5 text-[10px] tracking-widest" style={{ color: 'var(--caven-steel)' }}>{voiceNotes[0]?.when ?? ''}</div></div>) },
  { title: 'BRAIN DUMP', hint: 'Speak freely, I’ll sort it', body: (<div><Label>SPEAK FREELY</Label><div className="text-xs opacity-75">I'll sort it into notes, tasks, or reminders.</div></div>) },
  { title: 'CAVEN BRAIN', hint: 'What I remember', body: (<div><Label>WHAT I REMEMBER</Label><div className="text-xs opacity-75">Prefers tiny first steps · morning focus · loves space & cooking</div></div>) },
  ];
}

// Shared centered overlay for a chosen widget — smooth pop into the middle.
export function WidgetOverlay({ index, onClose }: { index: number; onClose: () => void }) {
  const widgets = useWidgets();
  const w = widgets[index];
  if (!w) return null;
  return (
    <div
      className="anim-overlay-fade fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: 'rgba(3,5,10,0.72)' }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClose}
    >
      <div className="holo-panel holo-hero anim-pop-in" style={{ width: 'min(88vw, 420px)' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="font-display text-sm tracking-[0.24em]" style={{ color: 'var(--caven-cyan-bright)' }}>{w.title}</div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-5 w-5 place-items-center rounded-full text-[11px] leading-none transition-transform active:scale-90"
            style={{ background: 'rgba(255,95,87,0.5)', border: '1px solid rgba(255,95,87,0.7)', color: '#ffe9e7' }}
          >
            ✕
          </button>
        </div>
        <div className="text-base">{w.body}</div>
      </div>
    </div>
  );
}
