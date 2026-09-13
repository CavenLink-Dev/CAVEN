import { useEffect, useMemo, useState } from 'react';
import { CavenCore } from './components/CavenCore/CavenCore';
import { MusicMenu } from './components/MusicMenu';
import { BottomNav } from './components/board/BottomNav';
import { DayBoard } from './components/board/DayBoard';
import { TopBar, type Page } from './components/board/TopBar';
import { MissionControl } from './components/pages/MissionControl';
import { SettingsPage } from './components/pages/SettingsPage';
import { BrainPage, JournalPage } from './components/pages/SimplePages';
import { useCaven } from './lib/cavenState';
import { useCavenStore } from './lib/store';
import { isMuted, setMuted } from './lib/sfx';

/** How long the board stays up after something changed, before it stands down. */
const BOARD_LINGER_MS = 45_000;

/** Three of the examples from Settings → Help, surfaced where they are needed.
 *  Tapping one runs it, so the first turn costs no typing and no guesswork. */
const STARTERS = [
  'Remind me to take the tablets every weekday at nine',
  'Add ring the dentist to my list',
  "What have I got on today?",
] as const;

/**
 * The spoken line, cut to a glanceable length. The point of this line is to be
 * read without being studied — a full reply below the core turned it into a
 * paragraph you had to stop and parse.
 */
function glance(text: string, words = 9): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= words) return parts.join(' ');
  return `${parts.slice(0, words).join(' ')}…`;
}

export default function App() {
  const [page, setPage] = useState<Page>('main');
  const [muted, setMutedState] = useState(isMuted());
  const [typed, setTyped] = useState('');
  // Stable element: a fresh <MusicMenu /> each render would defeat memo(TopBar).
  const musicMenu = useMemo(() => <MusicMenu />, []);
  const { state, amplitudeRef, transcript, reply, locked, conversing, wrapUp, boardCue, toggle, toggleLock, cancel, runCommand } =
    useCaven();
  // Save/action failures used to be written to state and never shown. They now
  // surface here, above everything, on whichever page the user is looking at.
  const { data, lastError, clearError, conflict, reload } = useCavenStore();

  // The board is not furniture. It comes up when a turn wrote something, or when
  // he asked about the board itself, and stands down again afterwards — so an
  // idle screen is the core and nothing else. useCaven raises the cue for both
  // occasions; `complete` alone would miss "what's on today?", which changes
  // nothing and is precisely when you want to see it.
  const [boardUp, setBoardUp] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  useEffect(() => {
    if (boardCue > 0) setBoardUp(true);
  }, [boardCue]);
  useEffect(() => {
    // Opened on purpose means it stays until it is closed again; nothing should
    // vanish from under someone who is reading it. boardCue is a dependency so
    // that a second command restarts the clock rather than letting the board go
    // dark partway through a run of them.
    if (!boardUp || boardOpen) return;
    const id = window.setTimeout(() => setBoardUp(false), BOARD_LINGER_MS);
    return () => window.clearTimeout(id);
  }, [boardUp, boardOpen, boardCue]);

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

  // What to say, for someone who has never said anything.
  //
  // The signed-in screen was a greeting, an unlabelled orb and an empty box. The
  // examples that make it obvious existed all along — buried at More → Help,
  // which is the last place a first-time user looks. These are the same lines,
  // shown where the question is actually being asked, and gone the moment the
  // board has anything on it.
  const boardEmpty =
    data.tasks.length === 0 &&
    data.reminders.length === 0 &&
    data.calendar.length === 0 &&
    data.voiceNotes.length === 0 &&
    data.journal.length === 0;

  const listening = state === 'listening';
  const line = listening ? transcript : reply;

  return (
    <main className="app-shell">
      <TopBar page={page} actions={musicMenu} />

      {/* Always-on listening is visible from every page — an always-hot mic the
          user can't see is a trust problem. */}
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

      {/* The full line, for assistive tech — the visible one is cut short. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {listening && transcript ? transcript : reply && !listening ? `CAVEN said: ${reply}` : ''}
      </div>

      {page === 'main' ? (
        <div className={`stage${boardUp ? ' has-board' : ''}`}>
          {/* Nothing at the top at all until there is something to say. When
              there is, it takes the top and the core settles to the bottom. */}
          {boardUp && (
            <div className="stage-board">
              <DayBoard open={boardOpen} onOpenChange={setBoardOpen} />
            </div>
          )}

          <div className="stage-core">
            <CavenCore
              state={state}
              amplitudeRef={amplitudeRef}
              locked={locked}
              conversing={conversing}
              onToggle={toggle}
              onLock={toggleLock}
            />

            {/* One line, kept short. Clicking it drops what CAVEN heard into the
                box so a mishearing is one edit rather than the whole sentence
                said again — the affordance is the line itself, not another row. */}
            <div className={`stage-line${wrapUp ? ' is-wrapping' : ''}`}>
              {line ? (
                <button
                  type="button"
                  className="stage-line-text"
                  onClick={() => transcript && setTyped(transcript)}
                  title={transcript ? `Heard: “${transcript}” — click to correct it` : undefined}
                >
                  {glance(line)}
                </button>
              ) : (
                <span className="stage-line-idle">{conversing ? 'Listening…' : ''}</span>
              )}
            </div>

            {boardEmpty && !line && !conversing && (
              <ul className="stage-hints">
                {STARTERS.map((hint) => (
                  <li key={hint}>
                    <button type="button" onClick={() => runCommand(hint)}>
                      &ldquo;{hint}&rdquo;
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div key={page} className="page-scroll anim-fade-up">
          {page === 'mission' && <MissionControl />}
          {page === 'journal' && <JournalPage />}
          {page === 'brain' && <BrainPage />}
          {page === 'settings' && <SettingsPage />}
        </div>
      )}

      {/* Off the board, a spoken or typed exchange would otherwise leave no
          trace on screen at all — so the line follows the user. */}
      {page !== 'main' && line && (
        <div className="page-reply metal-surface anim-fade-up" role="status">
          {line}
        </div>
      )}

      {/* The box, the mute and the nav travel together: on a phone they dock to
          the bottom as one unit, so the row never has to be pinned a fixed
          distance above a nav whose height changes when it wraps. */}
      <div className="dock">
        <div className="command-bar">
          <form
            className="command-form flex-1"
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
            {/* Enter has always sent. Nothing on screen said so, and there was no
                way at all to send with a mouse — the form had no submit control. */}
            {typed.trim() && (
              <button type="submit" className="command-send" aria-label="Send">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h13M12 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </form>

          {(locked || conversing) && (
            <button onClick={cancel} className="command-stop" type="button">
              STOP
            </button>
          )}

          <button
            type="button"
            onClick={toggleMute}
            className={`command-mute${muted ? ' is-muted' : ''}`}
            aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
            title={muted ? 'Unmute microphone' : 'Mute microphone'}
            aria-pressed={muted}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" fillOpacity="0.15" />
              {muted ? <path d="M17 9l4 4m0-4l-4 4" /> : <><path d="M16 8.5a4 4 0 0 1 0 7" /><path d="M18.5 6a7 7 0 0 1 0 12" opacity="0.6" /></>}
            </svg>
          </button>
        </div>

        {/* Navigation, beneath the box and out of the way of the orb. More opens
            the Settings page at the section it names. */}
        <BottomNav
          page={page}
          onPageChange={setPage}
          onSection={(id) => {
            setPage('settings');
            // After the page has painted, not before, or there is nothing to find.
            window.requestAnimationFrame(() =>
              document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
            );
          }}
        />
      </div>
    </main>
  );
}
