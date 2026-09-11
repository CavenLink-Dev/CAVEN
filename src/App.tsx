import { useState } from 'react';
import { CavenCore } from './components/CavenCore/CavenCore';
import { MusicMenu } from './components/MusicMenu';
import { CalendarCard } from './components/board/CalendarCard';
import { DailyOverviewCard } from './components/board/DailyOverviewCard';
import { RemindersCard } from './components/board/RemindersCard';
import { TasksCard } from './components/board/TasksCard';
import { TopBar, type Page } from './components/board/TopBar';
import { SettingsPage } from './components/pages/SettingsPage';
import { BrainPage, FinancePage, JournalPage } from './components/pages/SimplePages';
import { useCaven } from './lib/cavenState';
import { isMuted, setMuted } from './lib/sfx';

export default function App() {
  const [page, setPage] = useState<Page>('main');
  const [muted, setMutedState] = useState(isMuted());
  const [typed, setTyped] = useState('');
  const { state, amplitude, transcript, reply, locked, conversing, toggle, toggleLock, cancel, runCommand } =
    useCaven();

  // Enter sends immediately and takes the same path as speaking does.
  // It works mid-turn too, interrupting CAVEN rather than being ignored.
  const submitTyped = () => {
    const text = typed.trim();
    if (!text) return;
    setTyped('');
    runCommand(text);
  };

  return (
    <main className="app-shell">
      <TopBar page={page} onPageChange={setPage} actions={<MusicMenu />} />

      {/* Announce speech capture and CAVEN's replies to assistive tech. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {state === 'listening' && transcript
          ? transcript
          : reply && state !== 'listening'
            ? `CAVEN said: ${reply}`
            : ''}
      </div>

      {page === 'main' ? (
        <div className="board-grid">
          <div className="board-left">
            <DailyOverviewCard />
            <TasksCard />
          </div>

          <div className="flex flex-col items-center justify-center gap-3">
            {state === 'listening' && transcript && (
              <div
                className="metal-surface anim-fade-up max-w-[280px] rounded-2xl px-4 py-2 text-center text-sm"
                style={{ color: 'var(--caven-cyan-bright)' }}
              >
                {transcript}
              </div>
            )}
            {reply && state !== 'listening' && (
              <div
                className="metal-surface anim-fade-up max-w-[300px] rounded-2xl px-4 py-2.5 text-center text-sm"
                style={{ color: 'var(--caven-cyan-bright)', boxShadow: '0 0 22px rgba(63,208,255,0.22)' }}
              >
                <span
                  className="font-display mr-1 text-[9px] tracking-[0.25em]"
                  style={{ color: 'var(--caven-steel)' }}
                >
                  CAVEN
                </span>
                {reply}
              </div>
            )}
            <CavenCore
              state={state}
              amplitude={amplitude}
              locked={locked}
              conversing={conversing}
              onToggle={toggle}
              onLock={toggleLock}
            />
          </div>

          <div className="board-right">
            <CalendarCard />
            <RemindersCard />
          </div>
        </div>
      ) : (
        <div
          key={page}
          className="anim-fade-up overflow-y-auto py-6"
          style={{ minHeight: 'calc(100vh - 190px)', maxHeight: 'calc(100vh - 150px)' }}
        >
          {page === 'finance' && <FinancePage />}
          {page === 'journal' && <JournalPage />}
          {page === 'brain' && <BrainPage />}
          {page === 'settings' && <SettingsPage />}
        </div>
      )}

      <div className="mx-auto mt-3 flex w-[min(570px,100%)] items-center gap-2">
        <button
          onClick={() => {
            const next = !muted;
            setMuted(next);
            setMutedState(next);
          }}
          className="metal-surface grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={{ color: 'var(--caven-cyan-bright)' }}
          aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          type="button"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" fillOpacity="0.15" />
            {muted ? (
              <path d="M17 9l4 4m0-4l-4 4" />
            ) : (
              <>
                <path d="M16 8.5a4 4 0 0 1 0 7" />
                <path d="M18.5 6a7 7 0 0 1 0 12" opacity="0.6" />
              </>
            )}
          </svg>
        </button>

        <form
          className="flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            submitTyped();
          }}
        >
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Say something to CAVEN…"
            className="caven-text-input metal-surface h-9 w-full rounded-full px-3 text-sm placeholder:opacity-40"
            style={{ color: 'var(--caven-steel-light)' }}
            aria-label="Type a message to CAVEN"
          />
        </form>

        {(locked || conversing) && (
          <button
            onClick={cancel}
            className="metal-surface font-display shrink-0 rounded-full px-3 py-1.5 text-[10px] tracking-[0.2em]"
            style={{ color: 'var(--caven-steel)' }}
            type="button"
          >
            STOP
          </button>
        )}
      </div>
    </main>
  );
}
