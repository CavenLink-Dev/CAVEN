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

/** Keep the visible line readable without throwing away the rest of a reply. */
function replyPhrases(text: string, wordsPerPhrase = 12): string[] {
  const sentences = text.trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  const phrases: string[] = [];
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length; i += wordsPerPhrase) {
      const phrase = words.slice(i, i + wordsPerPhrase).join(' ');
      if (phrase) phrases.push(phrase);
    }
  }
  return phrases.length ? phrases : [''];
}

function ReplyLine({
  text,
  listening,
  transcript,
  onClick,
}: {
  text: string;
  listening: boolean;
  transcript: string;
  onClick: () => void;
}) {
  const phrases = useMemo(() => replyPhrases(text), [text]);
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    setPhraseIndex(0);
  }, [text]);

  useEffect(() => {
    if (listening || phraseIndex >= phrases.length - 1) return;
    const wordCount = phrases[phraseIndex]?.split(/\s+/).length ?? 1;
    const timer = window.setTimeout(
      () => setPhraseIndex((current) => Math.min(current + 1, phrases.length - 1)),
      Math.max(2400, Math.min(3600, wordCount * 230)),
    );
    return () => window.clearTimeout(timer);
  }, [listening, phraseIndex, phrases]);

  const safePhraseIndex = Math.min(phraseIndex, phrases.length - 1);
  const visibleText = listening ? phrases[phrases.length - 1] : phrases[safePhraseIndex];
  return (
    <button
      type="button"
      className="stage-line-text"
      onClick={onClick}
      title={transcript ? `Heard: “${transcript}” — click to correct it` : undefined}
    >
      <span key={`${text}-${phraseIndex}`} className="stage-line-phrase">
        {visibleText}
      </span>
    </button>
  );
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

      {/* The full line, for assistive tech — the visible line advances in readable
          phrases. Only on the main screen: elsewhere .page-reply is itself a live
          region showing the line in full, and both firing announced it twice. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {page !== 'main' ? '' : listening && transcript ? transcript : reply && !listening ? `CAVEN said: ${reply}` : ''}
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

            {/* Phrases advance without dropping the rest of a reply. Clicking the
                line drops what CAVEN heard into the box so a mishearing is one edit
                rather than the whole sentence said again. */}
            <div className={`stage-line${wrapUp ? ' is-wrapping' : ''}`}>
              {line ? (
                <ReplyLine
                  text={line}
                  listening={listening}
                  transcript={transcript}
                  onClick={() => transcript && setTyped(transcript)}
                />
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
            <div className="command-input-wrap">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Say something to CAVEN…"
                className="caven-text-input metal-surface w-full rounded-full placeholder:opacity-40"
                style={{ color: 'var(--caven-steel-light)' }}
                aria-label="Type a message to CAVEN"
              />
              {/* Send and mute live inside the pill on the right — one control
                  cluster, so the row stays a single clean bar. */}
              <div className="command-input-actions">
                {typed.trim() && (
                  <button type="submit" className="command-send" aria-label="Send">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h13M12 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`command-mute${muted ? ' is-muted' : ''}`}
                  aria-label={muted ? 'Unmute' : 'Mute'}
                  title={muted ? 'Unmute' : 'Mute'}
                  aria-pressed={muted}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" fillOpacity="0.18" />
                    {muted ? (
                      <>
                        <line x1="16" y1="9" x2="21" y2="14" />
                        <line x1="21" y1="9" x2="16" y2="14" />
                      </>
                    ) : (
                      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                    )}
                  </svg>
                </button>
              </div>
            </div>
          </form>

          {(locked || conversing) && (
            <button onClick={cancel} className="command-stop" type="button">
              STOP
            </button>
          )}
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
