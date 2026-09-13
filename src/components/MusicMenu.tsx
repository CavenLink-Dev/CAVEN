import { memo, useEffect, useRef, useState } from 'react';
import { isMuted, onMuteChange, playSfx } from '../lib/sfx';

// Background music the user can pick from the top-right. Files live in imports/.
const TRACKS = [
  { name: 'First Light', url: new URL('../imports/First_Light.mp3', import.meta.url).href },
  { name: 'Sunbeam', url: new URL('../imports/Sunbeam.mp3', import.meta.url).href },
  { name: 'Afterglow', url: new URL('../imports/Afterglow.mp3', import.meta.url).href },
  { name: 'Orbit', url: new URL('../imports/Orbit.mp3', import.meta.url).href },
  { name: 'Ascend', url: new URL('../imports/Ascend.mp3', import.meta.url).href },
  { name: 'Signal', url: new URL('../imports/Signal.mp3', import.meta.url).href },
  { name: 'Doodle', url: new URL('../imports/Doodle.mp3', import.meta.url).href },
  { name: 'Key Steps', url: new URL('../imports/Key_Steps.mp3', import.meta.url).href },
  { name: 'Heartbeat', url: new URL('../imports/Heartbeat.mp3', import.meta.url).href },
  { name: 'Stillwood', url: new URL('../imports/Stillwood.mp3', import.meta.url).href },
] as const;

function MusicMenuBase() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Lazily create the single looping audio element.
  const audio = () => {
    if (!audioRef.current) {
      const a = new Audio();
      a.loop = true;
      a.volume = volume;
      audioRef.current = a;
    }
    return audioRef.current;
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Muting silences the ambient track too, and unmuting picks it back up if a
  // track was playing when the user muted — so "mute" means the room goes quiet.
  const resumeOnUnmute = useRef(false);
  useEffect(() => {
    return onMuteChange(muted => {
      const a = audioRef.current;
      if (!a) return;
      if (muted) {
        resumeOnUnmute.current = !a.paused;
        a.pause();
        setPlaying(false);
      } else if (resumeOnUnmute.current) {
        resumeOnUnmute.current = false;
        void a.play().then(() => setPlaying(true)).catch(() => {});
      }
    });
  }, []);

  // Close the dropdown when clicking elsewhere.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const select = (i: number) => {
    const a = audio();
    if (current === i) {
      // Toggle play/pause on the active track.
      if (playing) {
        a.pause();
        setPlaying(false);
      } else {
        if (!isMuted()) a.play().catch(() => {});
        setPlaying(true);
      }
      return;
    }
    playSfx('select', 120);
    a.src = TRACKS[i].url;
    a.currentTime = 0;
    if (!isMuted()) a.play().catch(() => {});
    setCurrent(i);
    setPlaying(true);
  };

  const stop = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  const label = current !== null ? TRACKS[current].name : 'Music';

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full px-3 py-1.5 metal-surface"
        style={{ color: 'var(--caven-cyan-bright)' }}
        aria-label="Background music"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" fill={playing ? 'currentColor' : 'none'} />
          <circle cx="18" cy="16" r="3" fill={playing ? 'currentColor' : 'none'} />
        </svg>
        <span className="font-display t-micro tracking-[0.2em] max-w-[90px] truncate">{label.toUpperCase()}</span>
        {playing && (
          <span className="flex items-end gap-[2px] h-3" aria-hidden>
            <i className="eq-bar" style={{ animationDelay: '0ms' }} />
            <i className="eq-bar" style={{ animationDelay: '160ms' }} />
            <i className="eq-bar" style={{ animationDelay: '320ms' }} />
          </span>
        )}
      </button>

      {open && (
        <div className="music-menu anim-fade-up metal-surface">
          <div className="music-menu-head">
            <span className="music-menu-title font-display">AMBIENT MUSIC</span>
            {playing && (
              <button onClick={stop} className="music-menu-stop font-display">
                STOP
              </button>
            )}
          </div>

          <div className="music-menu-list">
            {TRACKS.map((t, i) => {
              const active = current === i;
              const nowPlaying = active && playing;
              return (
                <button
                  key={t.name}
                  onClick={() => select(i)}
                  className={`music-track${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  onMouseEnter={() => playSfx('select', 320)}
                >
                  <span className="music-track-name">{t.name}</span>
                  {nowPlaying ? (
                    <span className="music-track-eq" aria-hidden>
                      <i className="eq-bar" style={{ animationDelay: '0ms' }} />
                      <i className="eq-bar" style={{ animationDelay: '160ms' }} />
                      <i className="eq-bar" style={{ animationDelay: '320ms' }} />
                    </span>
                  ) : (
                    <span className="music-track-glyph" aria-hidden>
                      {active ? '❚❚' : '▶'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="music-menu-volume">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--caven-steel)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 9v6h4l5 4V5L8 9H4z" />
              <path d="M16 8.5a4 4 0 0 1 0 7" />
            </svg>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="music-menu-slider"
              aria-label="Music volume"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Memoised: useCaven() streams amplitude from App, and without this every
// frame of CAVEN speaking re-rendered this component for no reason.
export const MusicMenu = memo(MusicMenuBase)
