import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, RefObject } from 'react';
import type { CavenState } from '../../lib/cavenState';

// The core, reduced to what it is actually for: a thing you press to talk to,
// which shows you it is listening. It was 636 lines of SVG — three counter
// rotating reactor rings, a hexagonal bipyramid crystal, orbiting satellites,
// particle bursts, sweeps, rivets and glints. None of that told you anything
// the colour and the size of one orb doesn't.
//
// What survives is every behaviour, none of the ornament: one orb, one hairline
// ring, and colour for state. No SVG at all now — two elements and a gradient.

type Props = {
  state: CavenState;
  amplitudeRef: RefObject<number>;
  locked: boolean;
  conversing: boolean;
  onToggle: () => void;
  onLock: () => void;
};

/** Six states, four looks — acting rides with thinking, complete is the success flash. */
type CoreVisual = 'idle' | 'listening' | 'thinking' | 'speaking' | 'success';
const VISUAL: Record<CavenState, CoreVisual> = {
  idle: 'idle',
  listening: 'listening',
  thinking: 'thinking',
  acting: 'thinking',
  speaking: 'speaking',
  complete: 'success',
};

/** Whether the rig is lit at all, which is a separate axis from what it is doing. */
type PowerState = 'off' | 'on' | 'powering-off' | 'locked';
type PulseType = 'green' | 'red' | 'blue' | 'armed';

const POWER_LABEL: Record<PowerState, string> = {
  off: 'standing by',
  on: 'listening',
  'powering-off': 'standing down',
  locked: 'listening in the background',
};

/** The stylesheet damps motion too; this stops the amplitude loop churning as well. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return reduced;
}

export function CavenCore({ state, amplitudeRef, locked, conversing, onToggle, onLock }: Props) {
  const reduced = useReducedMotion();

  // Holds --core-amp, written straight from a rAF loop so live audio never
  // re-renders anything. Keep it that way: writing amplitude into React state
  // used to re-render the whole board on every animation frame.
  const zoneRef = useRef<HTMLDivElement>(null);

  const [pulse, setPulse] = useState<{ id: number; type: PulseType | null }>({ id: 0, type: null });
  const pulseId = useRef(0);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [standingDown, setStandingDown] = useState(false);
  const offTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      if (offTimer.current) clearTimeout(offTimer.current);
      if (clickTimer.current) clearTimeout(clickTimer.current);
    },
    [],
  );

  const flash = (type: PulseType) => {
    pulseId.current += 1;
    setPulse({ id: pulseId.current, type });
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulse((p) => ({ id: p.id, type: null })), 900);
  };

  const standDown = (on: boolean) => {
    if (offTimer.current) clearTimeout(offTimer.current);
    setStandingDown(on);
    if (on) offTimer.current = setTimeout(() => setStandingDown(false), 700);
  };

  // Single click toggles the mic, double click locks to background listening.
  // The press is acknowledged at once with a neutral pulse so the core never
  // feels dead, but the committing red/green waits out the double-click window —
  // otherwise it visibly performs the single-click action and then takes it back.
  const handleClick = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      standDown(false);
      flash('blue');
      onLock();
      return;
    }
    flash('armed');
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      const stopping = conversing || state !== 'idle';
      flash(stopping ? 'red' : 'green');
      standDown(stopping);
      onToggle();
    }, 220);
  };

  // Enter and Space activate the button natively. Only the shifted form is
  // intercepted, as the keyboard route to background listening.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.shiftKey) {
      e.preventDefault();
      standDown(false);
      flash('blue');
      onLock();
    }
  };

  const visual = VISUAL[state];
  const live = conversing || state !== 'idle';
  const power: PowerState = locked ? 'locked' : live ? 'on' : standingDown ? 'powering-off' : 'off';

  // Listening and speaking ride real audio; acting holds a small steady swell.
  // Only those need a per-frame loop, so the rAF runs only while something is
  // actually live and is otherwise a single write.
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const setAmp = (v: number) => zone.style.setProperty('--core-amp', String(v));
    if (reduced) return setAmp(1);
    if (state === 'acting') return setAmp(1.05);
    if (state !== 'listening' && state !== 'speaking') return setAmp(1);
    let raf = 0;
    const tick = () => {
      const a = Math.min(1, Math.max(0, amplitudeRef.current || 0));
      setAmp(state === 'listening' ? 1 + a * 0.22 : 1.04 + a * 0.18);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, reduced, amplitudeRef]);

  return (
    <div
      ref={zoneRef}
      className={`core-zone core-${power} core-${visual}`}
      style={{ '--core-amp': 1 } as CSSProperties}
    >
      <button
        type="button"
        className="core-button"
        onClick={handleClick}
        onKeyDown={onKeyDown}
        aria-label={`Caven core, currently ${POWER_LABEL[power]}. Click to start talking, click again to stop, double-click for background listening.`}
      >
        <span className="core-ring" aria-hidden="true" />
        <span className="core-amp" aria-hidden="true">
          <span className="core-orb" />
        </span>
        {pulse.type && <span key={pulse.id} className={`core-pulse pulse-${pulse.type}`} aria-hidden="true" />}
      </button>
    </div>
  );
}
