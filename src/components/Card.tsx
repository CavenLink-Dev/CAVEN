import type { ReactNode } from 'react';
import type { CardInstance } from '../lib/cavenState';

type Props = {
  card: CardInstance;
  depth: number; // 0 = front-most
  onClose: () => void;
  onFullscreen: () => void;
  onMinimize: () => void;
  children: ReactNode;
};

// macOS traffic-light control.
function Light({ color, glow, onClick, label }: { color: string; glow: string; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="h-3.5 w-3.5 rounded-full transition-transform active:scale-90"
      style={{ background: color, boxShadow: `0 0 8px ${glow}` }}
    />
  );
}

export function Card({ card, depth, onClose, onFullscreen, onMinimize, children }: Props) {
  const behind = depth > 0;

  return (
    <div
      className={`pointer-events-auto absolute anim-card-in ${card.fullscreen ? 'inset-3' : 'left-1/2 top-1/2'}`}
      style={
        card.fullscreen
          ? { zIndex: 50 }
          : {
              width: 'min(92vw, 380px)',
              transform: `translate(-50%, -50%) translateY(${depth * -14}px) scale(${1 - depth * 0.05})`,
              opacity: behind ? 0.55 : 1,
              filter: behind ? 'blur(1.5px)' : 'none',
              zIndex: 40 - depth,
            }
      }
    >
      <div
        className="metal-surface flex h-full flex-col overflow-hidden rounded-3xl"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(63,208,255,0.08), 0 0 40px rgba(63,208,255,0.12)' }}
      >
        {/* Title bar */}
        <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--caven-glass-border)' }}>
          <div className="flex items-center gap-2">
            <Light color="#ff5f57" glow="rgba(255,95,87,0.8)" onClick={onClose} label="Close" />
            <Light color="#febc2e" glow="rgba(254,188,46,0.8)" onClick={onFullscreen} label="Fullscreen" />
            <Light color="#28c840" glow="rgba(40,200,64,0.8)" onClick={onMinimize} label="Minimize" />
          </div>
          <div className="ml-1 flex-1 truncate font-display text-xs tracking-[0.25em]" style={{ color: 'var(--caven-cyan-bright)' }}>
            {card.title.toUpperCase()}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {card.transcript && (
            <div
              className="mb-3 rounded-xl px-3 py-2 text-xs italic"
              style={{ background: 'rgba(63,208,255,0.06)', color: 'var(--caven-steel-light)' }}
            >
              “{card.transcript}”
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
