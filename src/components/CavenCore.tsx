import { useRef, useState } from 'react';
import type { CavenState } from '../lib/cavenState';

type Props = {
  state: CavenState;
  amplitude: number;
  locked: boolean;
  onToggle: () => void;
  onLock: () => void;
};

const STATE_LABEL: Record<CavenState, string> = {
  idle: 'STANDING BY',
  listening: 'LISTENING',
  thinking: 'THINKING',
  acting: 'ACTING',
  speaking: 'SPEAKING',
  complete: 'COMPLETE',
};

// Ticks around the outer bezel.
function Ticks({ count = 60 }: { count?: number }) {
  return (
    <div className="absolute inset-0">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 h-1/2 w-px origin-top"
          style={{
            transform: `rotate(${(i / count) * 360}deg)`,
          }}
        >
          <div
            className="mx-auto"
            style={{
              width: i % 5 === 0 ? 2 : 1,
              height: i % 5 === 0 ? 10 : 5,
              background: 'var(--caven-steel)',
              opacity: i % 5 === 0 ? 0.7 : 0.35,
              boxShadow: i % 5 === 0 ? '0 0 6px var(--caven-glow)' : 'none',
            }}
          />
        </div>
      ))}
    </div>
  );
}

export function CavenCore({ state, amplitude, locked, onToggle, onLock }: Props) {
  // Transient color feedback: green = turning on, red = turning off, blue = lock.
  const [pulse, setPulse] = useState<'on' | 'off' | 'lock' | null>(null);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (p: 'on' | 'off' | 'lock') => {
    setPulse(p);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulse(null), 850);
  };

  // Distinguish single (toggle mic) from double click (lock to background).
  // Fire the color feedback immediately on click so it never feels dead.
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleClick = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      flash('lock');
      onLock();
      return;
    }
    flash(state === 'listening' ? 'off' : 'on');
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      onToggle();
    }, 220);
  };

  const listening = state === 'listening';
  const thinking = state === 'thinking';
  const acting = state === 'acting';
  const speaking = state === 'speaking';
  const complete = state === 'complete';
  const active = state !== 'idle';

  // Amplitude drives listening/speaking reactivity.
  // Both listening and speaking are driven by real audio amplitude.
  const coreScale = 1 + (listening ? amplitude * 0.28 : speaking ? 0.05 + amplitude * 0.22 : acting ? 0.06 : 0);

  return (
    <div className="relative flex flex-col items-center">
      <button
        onClick={handleClick}
        aria-label="Talk to CAVEN — click to speak, double-click to lock"
        className="relative grid place-items-center outline-none"
        style={{ width: 260, height: 260 }}
      >
        {/* Transient color feedback halo (green on / red off / blue lock) */}
        {pulse && <span className={`absolute rounded-full core-pulse core-pulse-${pulse}`} style={{ width: 150, height: 150 }} />}

        {/* Reactive ripples when acting/complete */}
        {(acting || complete) && (
          <>
            <span
              className="absolute rounded-full"
              style={{
                width: 200,
                height: 200,
                border: '1px solid var(--caven-cyan)',
                animation: 'ripple 1s ease-out infinite',
              }}
            />
            <span
              className="absolute rounded-full"
              style={{
                width: 200,
                height: 200,
                border: '1px solid var(--caven-cyan)',
                animation: 'ripple 1s ease-out 0.4s infinite',
              }}
            />
          </>
        )}

        {/* Outer bezel — metallic ring with ticks, slow rotation */}
        <div
          className={`absolute rounded-full ${active ? 'anim-spin-slow' : ''}`}
          style={{
            width: 250,
            height: 250,
            border: '1px solid rgba(138,149,165,0.35)',
            boxShadow: 'inset 0 0 30px rgba(138,149,165,0.12)',
          }}
        >
          <Ticks />
        </div>

        {/* Mid ring — counter-rotates; speeds up when thinking */}
        <div
          className={`absolute rounded-full ${thinking ? 'anim-spin-fast' : 'anim-spin-rev'}`}
          style={{
            width: 196,
            height: 196,
            border: '1.5px solid rgba(63,208,255,0.25)',
            borderTopColor: 'var(--caven-cyan)',
            borderRightColor: 'var(--caven-cyan-deep)',
            boxShadow: '0 0 18px rgba(63,208,255,0.35)',
          }}
        />

        {/* Inner arc segment */}
        <div
          className={`absolute rounded-full ${thinking ? 'anim-spin-rev' : active ? 'anim-spin-slow' : ''}`}
          style={{
            width: 156,
            height: 156,
            border: '2px solid transparent',
            borderBottomColor: 'var(--caven-cyan)',
            borderLeftColor: 'rgba(63,208,255,0.4)',
            filter: 'drop-shadow(0 0 6px var(--caven-glow))',
          }}
        />

        {/* The core orb */}
        <div
          className={`relative rounded-full ${complete ? 'anim-flash' : 'anim-glow'} ${state === 'idle' ? 'anim-breathe' : ''}`}
          style={{
            width: 118,
            height: 118,
            transform: `scale(${coreScale})`,
            transition: 'transform 90ms linear',
            background:
              'radial-gradient(circle at 50% 42%, var(--caven-cyan-bright) 0%, var(--caven-cyan) 30%, var(--caven-cyan-deep) 62%, #071018 100%)',
          }}
        >
          {/* Inner triangle nod to the arc reactor */}
          <div
            className="absolute inset-0 grid place-items-center opacity-80"
            style={{ filter: 'drop-shadow(0 0 8px var(--caven-cyan-bright))' }}
          >
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <path d="M26 8 L44 40 L8 40 Z" stroke="#eafaff" strokeWidth="2" opacity="0.9" />
              <circle cx="26" cy="30" r="6" fill="#eafaff" opacity="0.9" />
            </svg>
          </div>
        </div>
      </button>

      {/* Status readout */}
      <div className="mt-6 flex flex-col items-center anim-fade-up" key={state}>
        <div
          className="font-display text-sm tracking-[0.42em]"
          style={{ color: 'var(--caven-cyan-bright)', textShadow: '0 0 14px var(--caven-glow)' }}
        >
          {STATE_LABEL[state]}
        </div>
        <div className="mt-1 h-px w-24" style={{ background: 'linear-gradient(90deg,transparent,var(--caven-cyan),transparent)' }} />
        <div className="mt-2 text-[9px] tracking-[0.25em]" style={{ color: 'var(--caven-steel)' }}>
          {state === 'idle' ? (locked ? 'BACKGROUND · DOUBLE-CLICK TO UNLOCK' : 'CLICK TO SPEAK') : state === 'listening' ? 'CLICK TO SEND' : ''}
        </div>
        {locked && (
          <div
            className="mt-2 rounded-full px-2.5 py-0.5 font-display text-[9px] tracking-[0.28em]"
            style={{ color: 'var(--caven-cyan-bright)', border: '1px solid rgba(63,208,255,0.4)', boxShadow: '0 0 12px rgba(63,208,255,0.25)' }}
          >
            ● LISTENING IN BACKGROUND
          </div>
        )}
      </div>
    </div>
  );
}
