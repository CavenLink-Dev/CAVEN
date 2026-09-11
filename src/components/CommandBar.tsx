import { useState } from 'react';
import type { CavenState } from '../lib/cavenState';
import { voiceSupported } from '../lib/voice';

type Props = {
  state: CavenState;
  transcript: string;
  onListen: (demoText?: string) => void;
  onCancel: () => void;
};

const DEMOS = [
  'Remind me on September 5th at 6pm — dinner with Mom.',
  "How's my budget looking this month?",
  'Journal: today felt calm and I got through my routine.',
  'Show me my habits and streaks.',
];

export function CommandBar({ state, transcript, onListen, onCancel }: Props) {
  const [text, setText] = useState('');
  const busy = state !== 'idle';
  const supported = voiceSupported();

  const submit = () => {
    if (!text.trim() || busy) return;
    onListen(text.trim());
    setText('');
  };

  return (
    <div className="fixed inset-x-0 top-0 z-40 flex flex-col items-center px-4 pt-4">
      {/* live transcript */}
      {busy && transcript && (
        <div
          className="mb-3 max-w-md rounded-full px-4 py-1.5 text-center text-sm anim-fade-up"
          style={{ background: 'rgba(63,208,255,0.08)', color: 'var(--caven-cyan-bright)' }}
        >
          {transcript}
        </div>
      )}

      <div className="flex w-full max-w-md items-center gap-2">
        <div className="metal-surface flex flex-1 items-center gap-2 rounded-full px-4 py-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={supported ? 'Speak or type a command…' : 'Type a command…'}
            disabled={busy}
            className="w-full bg-transparent text-sm outline-none placeholder:opacity-40"
            style={{ color: 'var(--caven-steel-light)' }}
          />
        </div>

        <button
          onClick={() => (busy ? onCancel() : onListen())}
          aria-label={busy ? 'Cancel' : 'Talk to CAVEN'}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform active:scale-90"
          style={{
            background: busy ? 'rgba(255,95,87,0.15)' : 'rgba(63,208,255,0.14)',
            boxShadow: `0 0 18px ${busy ? 'rgba(255,95,87,0.4)' : 'var(--caven-glow)'}`,
            border: `1px solid ${busy ? 'rgba(255,95,87,0.5)' : 'rgba(63,208,255,0.4)'}`,
            color: busy ? '#ff8a84' : 'var(--caven-cyan-bright)',
          }}
        >
          {busy ? '✕' : '🎙'}
        </button>
      </div>

      {/* Demo chips when idle */}
      {!busy && (
        <div className="mt-3 flex max-w-md flex-wrap justify-center gap-1.5">
          {DEMOS.map((d) => (
            <button
              key={d}
              onClick={() => onListen(d)}
              className="rounded-full px-2.5 py-1 text-[10px] tracking-wide transition-colors"
              style={{ background: 'rgba(138,149,165,0.1)', color: 'var(--caven-steel)', border: '1px solid rgba(138,149,165,0.2)' }}
            >
              {d.length > 34 ? d.slice(0, 32) + '…' : d}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
