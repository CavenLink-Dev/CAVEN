import logoImg from '../../imports/image-6.png'
import wordmarkImg from '../../imports/image-5.png'

const NAV_PAGES = ['CAVEN', 'FINANCE', 'JOURNAL', 'BRAIN', 'SETTING']

export function TopBar() {
  return (
    <header className="topbar" style={{ paddingTop: '0px', paddingBottom: '0px' }}>
      <div className="relative flex items-center gap-3 group select-none" style={{ rowGap: '12px' }}>
        <div className="absolute inset-0 bg-cyan-500/20 opacity-0 group-hover:opacity-100 blur-xl rounded-full transition-opacity duration-700"></div>
        <img
          src={logoImg}
          alt="CAVEN Logo"
          className="relative h-[52px] w-[52px] object-contain drop-shadow-[0_0_8px_rgba(34,211,238,0.4)] [filter:invert(1)_hue-rotate(180deg)_drop-shadow(0_0_8px_rgba(34,211,238,0.4))]"
        />
        <img
          src={wordmarkImg}
          alt="CAVEN"
          className="relative h-[24px] w-auto object-contain [filter:invert(1)_hue-rotate(180deg)_drop-shadow(0_0_6px_rgba(34,211,238,0.45))]"
        />
      </div>
      <nav className="topbar-nav" style={{ width: 'fit-content', paddingTop: '4px', paddingBottom: '4px', alignItems: 'center' }}>
        {NAV_PAGES.map((page, i) => (
          <button
            key={page}
            className={`topbar-nav-item ${i === 0 ? 'is-active' : ''}`}
            style={
              i === 0
                ? { color: 'rgb(255, 255, 255)', fontWeight: 700 }
                : { color: 'rgb(171, 171, 171)' }
            }
            type="button"
            aria-current={i === 0 ? 'page' : undefined}
          >
            {page}
          </button>
        ))}
      </nav>
      <div className="flex items-center gap-4" style={{ alignItems: 'center' }}>
        <time className="hud-label" style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'rgba(255, 255, 255, 0.9)', padding: '0px', transform: 'translateX(-10px)' }}>
          09:42 · Thu 11 Sep
        </time>
        <span
          className="rounded-full border border-cyan-200/15 bg-cyan-100/5 font-bold text-cyan-100"
          style={{ height: '47px', width: '47px', paddingTop: '0px', paddingRight: '16px', paddingBottom: '0px', paddingLeft: '16px', fontSize: '25px', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
        >
          A
        </span>
      </div>
    </header>
  )
}
