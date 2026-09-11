import { calendar, habits, tasks, voiceNotes } from '../../lib/mockData';
import { Bar, Dot, Panel, Ring } from '../widgets';

// Summary tiles that frame the core on the main screen.
export function MainBoard() {
  const doneTasks = tasks.filter((t) => t.done).length;
  const next = calendar.find((c) => c.title === 'Dinner with Mom') ?? calendar[0];

  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-3">
      <Panel title="Habits">
        <div className="flex flex-wrap gap-3">
          {habits.slice(0, 4).map((h) => (
            <div key={h.id} className="flex flex-col items-center gap-1">
              <Ring value={Math.round((h.streak / h.goal) * 100)} label={h.icon} size={44} />
              <span className="text-[10px] opacity-70">{h.streak}d</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Tasks">
        <div className="mb-2 text-xs opacity-70">
          {doneTasks}/{tasks.length} done today
        </div>
        {tasks.slice(0, 3).map((t) => (
          <div key={t.id} className="mb-1.5 flex items-center gap-2 text-sm">
            <Dot done={t.done} />
            <span className={`truncate ${t.done ? 'line-through opacity-50' : ''}`}>{t.title}</span>
          </div>
        ))}
      </Panel>

      <Panel title="Up next">
        <div className="font-display text-2xl" style={{ color: 'var(--caven-cyan-bright)' }}>
          {next.time}
        </div>
        <div className="text-sm">{next.title}</div>
        <div className="mt-2">
          <Bar value={40} />
        </div>
      </Panel>

      <Panel title="Voice note">
        <div className="text-xs opacity-80 line-clamp-3">{voiceNotes[0].text}</div>
        <div className="mt-2 text-[10px] tracking-widest" style={{ color: 'var(--caven-steel)' }}>
          {voiceNotes[0].when}
        </div>
      </Panel>
    </div>
  );
}
