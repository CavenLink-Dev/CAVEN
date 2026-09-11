export type Page = 'main' | 'finance' | 'journal' | 'brain';

const ITEMS: { id: Page; label: string; icon: string }[] = [
  { id: 'main', label: 'Main', icon: '◎' },
  { id: 'finance', label: 'Finance', icon: '◈' },
  { id: 'journal', label: 'Journal', icon: '✎' },
  { id: 'brain', label: 'Brain', icon: '⟁' },
];

export function PageNav({ page, onChange }: { page: Page; onChange: (p: Page) => void }) {
  return (
    <nav className="opacity-90 transition-opacity duration-300 hover:opacity-100">
      <div className="metal-surface flex items-center gap-1 rounded-full px-2 py-1.5">
        {ITEMS.map((it) => {
          const active = page === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors"
              style={{
                background: active ? 'rgba(63,208,255,0.14)' : 'transparent',
                boxShadow: active ? 'inset 0 0 0 1px rgba(63,208,255,0.35)' : 'none',
              }}
            >
              <span style={{ color: active ? 'var(--caven-cyan-bright)' : 'var(--caven-steel)' }}>{it.icon}</span>
              <span
                className="hidden font-display text-[10px] tracking-[0.2em] sm:inline"
                style={{ color: active ? 'var(--caven-cyan-bright)' : 'var(--caven-steel)' }}
              >
                {it.label.toUpperCase()}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
