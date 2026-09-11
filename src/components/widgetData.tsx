import { useCavenStore } from '../lib/store';
import { Bar, Dot, Ring } from './widgets';

export type Widget = { title: string; hint: string; body: React.ReactNode };

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2 font-display text-[10px] tracking-[0.26em]" style={{ color: 'var(--caven-steel)' }}>
    {children}
  </div>
);

const M = () => <span style={{ color: 'var(--caven-cyan)' }}>▹</span>;

const L = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-sm">
    <M />
    <span className="truncate">{children}</span>
  </div>
);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="text-xs opacity-70">{children}</div>
);

function habitRing(streak: number, goal: number) {
  if (!goal) return 0;
  return Math.round((streak / goal) * 100);
}

export function useWidgets(): Widget[] {
  const { data } = useCavenStore();
  const { brainMetrics, brainNotes, budgets, calendar, habits, interests, reminders, tasks, transactions, voiceNotes } = data;
  const openTask = tasks.find((t) => !t.done);
  const nextReminder = reminders[0];
  const energy = brainMetrics.find((m) => /energy/i.test(m.label));
  const remembered = [...interests.slice(0, 2), ...brainNotes.slice(0, 2)].filter(Boolean);

  return [
    {
      title: 'RIGHT NOW',
      hint: 'The next useful thing',
      body: openTask ? (
        <div>
          <div className="text-lg font-semibold" style={{ color: 'var(--caven-cyan-bright)' }}>{openTask.title}</div>
          {openTask.time && <div className="mt-1 text-sm opacity-75">{openTask.time}</div>}
        </div>
      ) : nextReminder ? (
        <div>
          <div className="text-lg font-semibold" style={{ color: 'var(--caven-cyan-bright)' }}>{nextReminder.title}</div>
          <div className="mt-1 text-sm opacity-75">{[nextReminder.date, nextReminder.time].filter(Boolean).join(' · ')}</div>
        </div>
      ) : (
        <Empty>Nothing on the board yet.</Empty>
      ),
    },
    {
      title: 'REMINDERS',
      hint: 'On the board',
      body: reminders.length ? (
        <div className="space-y-1">
          {reminders.slice(0, 2).map((r) => (
            <L key={r.id}>{[r.title, r.date, r.time].filter(Boolean).join(' — ')}</L>
          ))}
        </div>
      ) : (
        <Empty>No reminders saved.</Empty>
      ),
    },
    {
      title: "TODAY'S TIMELINE",
      hint: 'Appointments & free time',
      body: calendar.length ? (
        <div>
          {calendar.slice(0, 4).map((e) => (
            <div key={e.id} className="mb-1 flex items-center gap-2 text-sm">
              <span className="font-display text-xs" style={{ color: 'var(--caven-cyan)' }}>{e.time}</span>
              <span className="truncate">{e.title}</span>
            </div>
          ))}
        </div>
      ) : (
        <Empty>Nothing on the calendar yet.</Empty>
      ),
    },
    {
      title: 'TIME TO LEAVE',
      hint: 'Prep + travel + departure',
      body: <Empty>Travel times aren't calculated.</Empty>,
    },
    {
      title: 'TASKS',
      hint: 'Capture & choose what matters',
      body: tasks.length ? (
        <div>
          {tasks.slice(0, 3).map((t) => (
            <div key={t.id} className="mb-1.5 flex items-center gap-2 text-sm">
              <Dot done={t.done} />
              <span className={`truncate ${t.done ? 'line-through opacity-50' : ''}`}>{t.title}</span>
            </div>
          ))}
        </div>
      ) : (
        <Empty>No tasks yet.</Empty>
      ),
    },
    {
      title: 'FOCUS TIMER',
      hint: 'Start · pause · break',
      body: (
        <div className="flex items-center gap-3">
          <Ring value={0} label="—" size={58} />
          <div className="text-xs opacity-75">No timer running</div>
        </div>
      ),
    },
    {
      title: 'HABITS',
      hint: 'Gentle check-ins',
      body: habits.length ? (
        <div className="flex flex-wrap gap-3">
          {habits.slice(0, 4).map((h) => (
            <div key={h.id} className="flex flex-col items-center gap-1">
              <Ring value={habitRing(h.streak, h.goal)} label={`${h.streak}`} size={42} />
              <span className="text-[10px] opacity-70">{h.streak}d</span>
            </div>
          ))}
        </div>
      ) : (
        <Empty>No habits yet.</Empty>
      ),
    },
    {
      title: 'FINANCE',
      hint: 'Spending, bills, savings',
      body: budgets.length || transactions[0] ? (
        <div className="space-y-2">
          {budgets.slice(0, 2).map((b) => (
            <div key={b.id}>
              <div className="mb-1 flex justify-between text-xs">
                <span>{b.category}</span>
                <span className="opacity-70">${b.spent}/{b.limit}</span>
              </div>
              <Bar value={b.limit ? (b.spent / b.limit) * 100 : 0} />
            </div>
          ))}
          <div className="text-xs opacity-70">{transactions[0] ? `Latest: ${transactions[0].label} $${Math.abs(transactions[0].amount)}` : 'No transactions yet'}</div>
        </div>
      ) : (
        <Empty>No money on the board yet.</Empty>
      ),
    },
    {
      title: 'MOOD & ENERGY',
      hint: 'Check-in & adjust plan',
      body: energy ? (
        <div className="flex items-center gap-3">
          <Ring value={energy.value} label={`${energy.value}`} size={50} />
          <div className="text-xs opacity-75">{energy.hint || energy.label}</div>
        </div>
      ) : (
        <Empty>No check-in saved.</Empty>
      ),
    },
    {
      title: 'VOICE NOTES',
      hint: 'Transcript + summary',
      body: (
        <div>
          <div className="text-xs opacity-80">{voiceNotes[0]?.text ?? 'Say a note and I’ll keep it here.'}</div>
          <div className="mt-1.5 text-[10px] tracking-widest" style={{ color: 'var(--caven-steel)' }}>{voiceNotes[0]?.when ?? ''}</div>
        </div>
      ),
    },
    {
      title: 'BRAIN DUMP',
      hint: 'Speak freely, I’ll sort it',
      body: (
        <div>
          <Label>SPEAK FREELY</Label>
          <div className="text-xs opacity-75">I'll sort it into notes, tasks, or reminders.</div>
        </div>
      ),
    },
    {
      title: 'CAVEN BRAIN',
      hint: 'What I remember',
      body: (
        <div>
          <Label>WHAT I REMEMBER</Label>
          <div className="text-xs opacity-75">{remembered.length ? remembered.join(' · ') : 'Nothing saved yet.'}</div>
        </div>
      ),
    },
  ];
}

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
