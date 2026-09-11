import type { ReactNode } from 'react';

export function Panel({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`metal-surface rounded-2xl p-3.5 ${className}`}>
      {title && (
        <div className="mb-2.5 font-display t-micro tracking-[0.28em]" style={{ color: 'var(--caven-steel)' }}>
          {title.toUpperCase()}
        </div>
      )}
      {children}
    </div>
  );
}

export function Ring({ value, size = 56, label }: { value: number; size?: number; label?: string }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(138,149,165,0.25)" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--caven-cyan)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          style={{ filter: 'drop-shadow(0 0 4px var(--caven-glow))', transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute font-display text-xs" style={{ color: 'var(--caven-cyan-bright)' }}>
        {label ?? `${value}`}
      </div>
    </div>
  );
}

export function Bar({ value }: { value: number }) {
  const over = value > 100;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(138,149,165,0.2)' }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.min(100, value)}%`,
          background: over ? 'var(--caven-cyan-bright)' : 'var(--caven-cyan)',
          boxShadow: '0 0 8px var(--caven-glow)',
          transition: 'width 0.8s ease',
        }}
      />
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-center gap-3 border-b py-2.5 last:border-0"
      style={{ borderColor: 'rgba(138,149,165,0.14)' }}
    >
      {children}
    </div>
  );
}

export function Dot({ done }: { done: boolean }) {
  return (
    <span
      className="grid h-5 w-5 shrink-0 place-items-center rounded-full t-micro"
      style={{
        border: `1.5px solid ${done ? 'var(--caven-cyan)' : 'rgba(138,149,165,0.4)'}`,
        color: 'var(--caven-cyan-bright)',
        boxShadow: done ? '0 0 8px var(--caven-glow)' : 'none',
      }}
    >
      {done ? '✓' : ''}
    </span>
  );
}
