import { useMemo, useState } from 'react';
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
import { useCavenStore } from './lib/store';
import { isMuted, setMuted } from './lib/sfx';

export default function App() {
  const [page, setPage] = useState<Page>('main');
  const [muted, setMutedState] = useState(isMuted());
  const [typed, setTyped] = useState('');
  // Stable element: a fresh <MusicMenu /> each render would defeat memo(TopBar).
  const musicMenu = useMemo(() => <MusicMenu />, []);
  const { state, amplitudeRef, transcript, reply, locked, conversing, wrapUp, toggle, toggleLock, cancel, runCommand } =
    useCaven();
  // Save/action failures used to be written to state and never shown. They now
  // surface here, above the board, on whichever page the user is looking at.
  const { lastError, clearError, conflict, reload } = useCavenStore();

  // Enter sends immediately and takes the same path as speaking does.
  // It works mid-turn too, interrupting CAVEN rather than being ignored.
  const submitTyped = () => {
    const text = typed.trim();
    if (!text) return;
    setTyped('');
    runCommand(text);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  return (
    <main className="app-shell">
      <TopBar page={page} onPageChange={setPage} actions={musicMenu} />

      {/* Always-on listening is visible from every page, not just the board —
          an always-hot mic the user can't see is a trust problem. */}
      {locked && (
        <div className="listening-banner" role="status">
          <span className="listening-dot" aria-hidden="true" />
          <span>Listening in background</span>
          <button type="button" onClick={cancel}>Stop</button>
        </div>
      )}

      {lastError && (
        <div className="save-strip" role="alert">
          <span>{lastError}</span>
          {/* A version conflict cannot be retried away — this tab is behind the
              server and every later save fails the same way. Dismiss alone left
              the user stuck, so the one action that actually helps goes here. */}
          {conflict && (
            <button type="button" onClick={() => void reload()}>Reload board</button>
          )}
          <button type="button" onClick={clearError} aria-label="Dismiss">Dismiss</button>
        </div>
      )}

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

          <div className="board-center">
            {/* Fixed-height slot so an appearing transcript/reply never shifts
                the core (or the panels either side of it). */}
            <div className="board-center-msgs">
              {state === 'listening' && transcript && (
                <div
                  className={`metal-surface anim-fade-up max-w-[280px] rounded-2xl px-4 py-2 text-center text-sm${wrapUp ? ' is-wrapping' : ''}`}
                  style={{ color: 'var(--caven-cyan-bright)' }}
                >
                  {transcript}
                  {/* Warns before the silence cutoff closes the mic, so a pause
                      to think doesn't end the sentence without warning. */}
                  {wrapUp && <span className="wrap-hint">still listening — keep going</span>}
                </div>
              )}
              {reply && state !== 'listening' && (
                <div
                  className="metal-surface anim-fade-up max-w-[300px] rounded-2xl px-4 py-2.5 text-center text-sm"
                  style={{ color: 'var(--caven-cyan-bright)', boxShadow: '0 0 22px rgba(63,208,255,0.22)' }}
                >
                  <span
                    className="font-display mr-1 t-micro tracking-[0.25em]"
                    style={{ color: 'var(--caven-steel)' }}
                  >
                    CAVEN
                  </span>
                  {reply}
                  {/* What CAVEN actually heard, with one click to correct it —
                      previously a mishearing meant repeating the whole thing. */}
                  {transcript && state === 'idle' && (
                    <button
                      type="button"
                      className="heard-line"
                      onClick={() => setTyped(transcript)}
                      title="Put this in the box to correct and resend"
                    >
                      heard: “{transcript}” — edit
                    </button>
                  )}
                </div>
              )}
            </div>
            <CavenCore
              state={state}
              amplitudeRef={amplitudeRef}
              locked={locked}
              conversing={conversing}
              onToggle={toggle}
              onLock={toggleLock}
              muted={muted}
              onToggleMute={toggleMute}
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

      {/* Off the board, a spoken or typed exchange would otherwise leave no trace
          on screen at all — so the live transcript and reply follow the user. */}
      {page !== 'main' && (state === 'listening' ? transcript : reply) && (
        <div className="page-reply metal-surface anim-fade-up" role="status">
          {state !== 'listening' && (
            <span className="font-display mr-1 t-micro tracking-[0.25em]" style={{ color: 'var(--caven-steel)' }}>
              CAVEN
            </span>
          )}
          {state === 'listening' ? transcript : reply}
        </div>
      )}

      <div className="mx-auto mt-3 flex w-[min(570px,100%)] items-center gap-2">
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
            className="metal-surface font-display shrink-0 rounded-full px-3 py-1.5 t-micro tracking-[0.2em]"
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
