import { useCavenStore } from '../../lib/store';
import { Dot, Panel, Ring } from '../widgets';

export function MainBoard() {
  const { data } = useCavenStore();
  const { calendar, habits, tasks, voiceNotes } = data;
  const doneTasks = tasks.filter((t) => t.done).length;
  const next = calendar[0];

  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-3">
      <Panel title="Habits">
        {habits.length ? (
          <div className="flex flex-wrap gap-3">
            {habits.slice(0, 4).map((h) => (
              <div key={h.id} className="flex flex-col items-center gap-1">
                <Ring value={h.goal ? Math.round((h.streak / h.goal) * 100) : 0} label={h.icon} size={44} />
                <span className="text-[10px] opacity-70">{h.streak}d</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs opacity-70">No habits yet.</div>
        )}
      </Panel>

      <Panel title="Tasks">
        <div className="mb-2 text-xs opacity-70">
          {tasks.length ? `${doneTasks}/${tasks.length} done` : 'No tasks yet.'}
        </div>
        {tasks.slice(0, 3).map((t) => (
          <div key={t.id} className="mb-1.5 flex items-center gap-2 text-sm">
            <Dot done={t.done} />
            <span className={`truncate ${t.done ? 'line-through opacity-50' : ''}`}>{t.title}</span>
          </div>
        ))}
      </Panel>

      <Panel title="Up next">
        {next ? (
          <>
            <div className="font-display text-2xl" style={{ color: 'var(--caven-cyan-bright)' }}>
              {next.time}
            </div>
            <div className="text-sm">{next.title}</div>
          </>
        ) : (
          <div className="text-xs opacity-70">Nothing coming up.</div>
        )}
      </Panel>

      <Panel title="Voice note">
        <div className="text-xs opacity-80 line-clamp-3">{voiceNotes[0]?.text ?? 'Say a note and I’ll keep it here.'}</div>
        <div className="mt-2 text-[10px] tracking-widest" style={{ color: 'var(--caven-steel)' }}>
          {voiceNotes[0]?.when ?? ''}
        </div>
      </Panel>
    </div>
  );
}
