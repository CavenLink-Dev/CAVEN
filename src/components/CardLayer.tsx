import type { CardInstance } from '../lib/cavenState';
import { Card } from './Card';
import { CardContent } from './cards/CardContent';

type Props = {
  cards: CardInstance[];
  onClose: (id: string) => void;
  onUpdate: (id: string, patch: Partial<CardInstance>) => void;
};

export function CardLayer({ cards, onClose, onUpdate }: Props) {
  const visible = cards.filter((c) => !c.minimized);
  const minimized = cards.filter((c) => c.minimized);
  // Front-most = last in array.
  const stack = [...visible].reverse();

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-30">
        <div className="pointer-events-none relative h-full w-full">
          {stack.map((c, i) => (
            <Card
              key={c.id}
              card={c}
              depth={i}
              onClose={() => onClose(c.id)}
              onFullscreen={() => onUpdate(c.id, { fullscreen: !c.fullscreen })}
              onMinimize={() => onUpdate(c.id, { minimized: true, fullscreen: false })}
            >
              <CardContent kind={c.kind} />
            </Card>
          ))}
        </div>
      </div>

      {/* Minimized dock */}
      {minimized.length > 0 && (
        <div className="fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 gap-2">
          {minimized.map((c) => (
            <button
              key={c.id}
              onClick={() => onUpdate(c.id, { minimized: false })}
              className="metal-surface rounded-full px-3 py-1.5 font-display text-[10px] tracking-[0.2em]"
              style={{ color: 'var(--caven-cyan-bright)', boxShadow: '0 0 16px rgba(63,208,255,0.2)' }}
            >
              {c.title.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
