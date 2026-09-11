import { useEffect, useState } from 'react';
import { CardLayer } from './components/CardLayer';
import { CavenCore } from './components/CavenCore';
import { FlatBoard } from './components/FlatBoard';
import { MusicMenu } from './components/MusicMenu';
import { PageNav, type Page } from './components/PageNav';
import { BrainPage, FinancePage, JournalPage } from './components/pages/SimplePages';
import { useCaven } from './lib/cavenState';
import { isMuted, setMuted, startAmbient } from './lib/sfx';

export default function App() {
  const [page, setPage] = useState<Page>('main');
  const [muted, setMutedState] = useState(isMuted());
  const { state, amplitude, transcript, reply, locked, cards, toggle, toggleLock, cancel, updateCard, closeCard } = useCaven();

  // Autoplay is gated behind a user gesture — start the ambient bed on first interaction.
  useEffect(() => {
    const kick = () => startAmbient();
    window.addEventListener('pointerdown', kick, { once: true });
    return () => window.removeEventListener('pointerdown', kick);
  }, []);

  return (
    <div className="relative size-full overflow-hidden">
      <div className="caven-backdrop" />

      {/* Header — bulky wordmark with the page nav to its right */}
      <div className="fixed left-5 top-4 z-40 flex items-center gap-4">
        <div
          className="font-display text-4xl font-black tracking-[0.32em]"
          style={{ color: 'var(--caven-cyan-bright)', textShadow: '0 0 22px var(--caven-glow), 0 0 6px var(--caven-cyan)' }}
        >
          CAVEN
        </div>
        <PageNav page={page} onChange={setPage} />
      </div>

      {/* Top-right: background music picker */}
      <div className="fixed right-5 top-4 z-40">
        <MusicMenu />
      </div>

      {/* Page content */}
      <div className="relative z-10 h-full">
        {page === 'main' ? (
          <FlatBoard />
        ) : (
          <div className="flex h-full justify-start overflow-y-auto px-5 pb-10 pt-20 pr-[46%]">
            <div key={page} className="anim-fade-up w-full">
              {page === 'finance' && <FinancePage />}
              {page === 'journal' && <JournalPage />}
              {page === 'brain' && <BrainPage />}
            </div>
          </div>
        )}
      </div>

      {/* CAVEN core — anchored to the right, vertically centered */}
      <div className="pointer-events-none fixed right-2 top-1/2 z-30 -translate-y-1/2 sm:right-8">
        <div className="pointer-events-auto flex flex-col items-center">
          {/* Chat box: your words while listening, CAVEN's reply while speaking */}
          {state === 'listening' && transcript && (
            <div
              className="mb-4 max-w-[260px] rounded-2xl px-4 py-2 text-center text-sm anim-fade-up metal-surface"
              style={{ color: 'var(--caven-cyan-bright)' }}
            >
              {transcript}
            </div>
          )}
          {(state === 'speaking' || state === 'complete') && reply && (
            <div
              className="mb-4 max-w-[280px] rounded-2xl px-4 py-2.5 text-center text-sm anim-fade-up metal-surface"
              style={{ color: 'var(--caven-cyan-bright)', boxShadow: '0 0 22px rgba(63,208,255,0.22)' }}
            >
              <span className="font-display mr-1 text-[9px] tracking-[0.25em]" style={{ color: 'var(--caven-steel)' }}>CAVEN</span>
              {reply}
            </div>
          )}
          <CavenCore state={state} amplitude={amplitude} locked={locked} onToggle={toggle} onLock={toggleLock} />
        </div>
      </div>

      <CardLayer cards={cards} onClose={closeCard} onUpdate={updateCard} />

      {/* Bottom-left controls: mute (and STOP while locked) */}
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

        {locked && (
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
