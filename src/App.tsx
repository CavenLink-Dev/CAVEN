import { useState } from 'react';
import { CardLayer } from './components/CardLayer';
import { CavenCore } from './components/CavenCore';
import { FlatBoard } from './components/FlatBoard';
import { MusicMenu } from './components/MusicMenu';
import { PageNav, type Page } from './components/PageNav';
import { BrainPage, FinancePage, JournalPage } from './components/pages/SimplePages';
import { useCaven } from './lib/cavenState';
import { isMuted, setMuted } from './lib/sfx';

export default function App() {
  const [page, setPage] = useState<Page>('main');
  const [muted, setMutedState] = useState(isMuted());
  const [typed, setTyped] = useState('');
  const { state, amplitude, transcript, reply, locked, conversing, cards, toggle, toggleLock, cancel, updateCard, closeCard, runCommand } = useCaven();

  // Enter sends immediately and gets the same Claude reply as speaking does.
  // It works mid-turn too, interrupting CAVEN rather than being ignored.
  const submitTyped = () => {
    const text = typed.trim();
    if (!text) return;
    setTyped('');
    runCommand(text);
  };

  return (
    <div className="relative size-full overflow-hidden">
      <div className="caven-backdrop" />

      <div className="fixed left-4 top-4 z-40 flex max-w-[calc(100%-6.5rem)] flex-wrap items-center gap-3 sm:left-5 sm:max-w-none">
        <div
          className="font-display text-2xl font-black tracking-[0.28em] sm:text-4xl sm:tracking-[0.32em]"
          style={{ color: 'var(--caven-cyan-bright)', textShadow: '0 0 22px var(--caven-glow), 0 0 6px var(--caven-cyan)' }}
        >
          CAVEN
        </div>
        <PageNav page={page} onChange={setPage} />
      </div>

      <div className="fixed right-4 top-4 z-40 sm:right-5">
        <MusicMenu />
      </div>

      <div className="relative z-10 h-full">
        {page === 'main' ? (
          <FlatBoard />
        ) : (
          <div className="flex h-full justify-start overflow-y-auto px-5 pb-72 pt-20 md:pr-[46%] md:pb-10">
            <div key={page} className="anim-fade-up w-full">
              {page === 'finance' && <FinancePage />}
              {page === 'journal' && <JournalPage />}
              {page === 'brain' && <BrainPage />}
            </div>
          </div>
        )}
      </div>

      <div className="pointer-events-none fixed bottom-16 left-1/2 z-30 -translate-x-1/2 md:bottom-auto md:left-auto md:right-8 md:top-1/2 md:translate-x-0 md:-translate-y-1/2">
        <div className="pointer-events-auto flex origin-bottom flex-col items-center md:origin-center max-md:scale-[0.72]">
          {state === 'listening' && transcript && (
            <div
              className="mb-4 max-w-[260px] rounded-2xl px-4 py-2 text-center text-sm anim-fade-up metal-surface"
              style={{ color: 'var(--caven-cyan-bright)' }}
            >
              {transcript}
            </div>
          )}
          {reply && state !== 'listening' && (
            <div
              className="mb-4 max-w-[280px] rounded-2xl px-4 py-2.5 text-center text-sm anim-fade-up metal-surface"
              style={{ color: 'var(--caven-cyan-bright)', boxShadow: '0 0 22px rgba(63,208,255,0.22)' }}
            >
              <span className="font-display mr-1 text-[9px] tracking-[0.25em]" style={{ color: 'var(--caven-steel)' }}>CAVEN</span>
              {reply}
            </div>
          )}
          <CavenCore state={state} amplitude={amplitude} locked={locked} conversing={conversing} onToggle={toggle} onLock={toggleLock} />
        </div>
      </div>

      <CardLayer cards={cards} onClose={closeCard} onUpdate={updateCard} />

      <form
        className="fixed bottom-4 left-1/2 z-40 flex w-[min(92vw,22rem)] -translate-x-1/2 items-center gap-2 md:left-16 md:translate-x-0"
        onSubmit={(e) => {
          e.preventDefault();
          submitTyped();
        }}
      >
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Say something to CAVEN…"
          className="metal-surface h-9 w-full rounded-full px-3 text-sm outline-none placeholder:opacity-40"
          style={{ color: 'var(--caven-steel-light)' }}
          aria-label="Type a message to CAVEN"
        />
      </form>

      <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2">
        <button
          onClick={() => {
            const next = !muted;
            setMuted(next);
            setMutedState(next);
          }}
          className="grid h-9 w-9 place-items-center rounded-full metal-surface"
          style={{ color: 'var(--caven-cyan-bright)' }}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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

        {(locked || conversing) && (
          <button
            onClick={cancel}
            className="rounded-full px-3 py-1.5 font-display text-[10px] tracking-[0.2em] metal-surface"
            style={{ color: 'var(--caven-steel)' }}
          >
            STOP
          </button>
        )}
      </div>
    </div>
  );
}
