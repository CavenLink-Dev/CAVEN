// Writes dist/__check.html — the real class names against the real compiled
// stylesheet, with no signed-in session in the way, so the main screen can be
// looked at in both of its states at any width. Throwaway: `pnpm build` clears
// dist, so re-run this after each build. Not shipped, not referenced by the app.
import { readdirSync, writeFileSync } from 'node:fs'

const css = readdirSync('dist/assets').find((f) => /^index-.*\.css$/.test(f))
if (!css) throw new Error('build dist first')

const core = (power = 'off', visual = 'idle') => `
<div class="core-zone core-${power} core-${visual}" style="--core-amp:1">
  <button type="button" class="core-button">
    <span class="core-ring"></span>
    <span class="core-amp"><span class="core-orb"></span></span>
  </button>
</div>`

const line = (text) => `
<div class="stage-line"><button type="button" class="stage-line-text">${text}</button></div>`

const commandBar = `
<div class="command-bar">
  <form class="flex-1"><input class="caven-text-input metal-surface h-9 w-full rounded-full px-3 text-sm" placeholder="Say something to CAVEN&hellip;" /></form>
  <button type="button" class="command-mute" aria-label="Mute">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" fill-opacity="0.15" /><path d="M16 8.5a4 4 0 0 1 0 7" /><path d="M18.5 6a7 7 0 0 1 0 12" opacity="0.6" />
    </svg>
  </button>
</div>`

const topbar = `
<header class="topbar">
  <div class="relative flex items-center gap-3 group select-none">
    <div class="topbar-logo" style="background:#123;border-radius:8px"></div>
    <div class="topbar-wordmark" style="width:96px;background:#134;border-radius:4px"></div>
  </div>
  <nav class="topbar-nav" aria-label="Pages">
    <button class="topbar-nav-item is-active" type="button">CAVEN</button>
    <button class="topbar-nav-item" type="button">FINANCE</button>
    <button class="topbar-nav-item" type="button">JOURNAL</button>
    <button class="topbar-nav-item" type="button">BRAIN</button>
    <button class="topbar-nav-item" type="button">SETTING</button>
  </nav>
  <div class="topbar-side flex items-center gap-4">
    <div class="topbar-actions"><span style="display:block;width:28px;height:28px;border-radius:50%;background:#1a3b47"></span></div>
    <time class="hud-label topbar-clock">19:42 &middot; Sat 12 Sep</time>
    <span class="topbar-avatar rounded-full border border-cyan-200/15 bg-cyan-100/5 font-bold text-cyan-100">K</span>
  </div>
</header>`

const item = (label, kind = 'event', task = false, overdue = false) =>
  task
    ? `<button type="button" class="day-item day-item--task"><span class="day-tick"></span><span class="day-label">${label}</span></button>`
    : `<span class="day-item day-item--${kind}${overdue ? ' is-overdue' : ''}"><span class="day-label">${label}</span></span>`

// 8am–8pm, with most of it deliberately empty — a free afternoon should look free.
const filled = { 9: [item('Ring the dentist', 'task', true)], 14: [item('Physio', 'event')], 18: [item('Tablets', 'reminder')] }
const hours = Array.from({ length: 13 }, (_, i) => i + 8)
  .map((h) => {
    const items = filled[h] ?? []
    const label = new Intl.DateTimeFormat('en-AU', { hour: 'numeric' }).format(new Date(2026, 0, 1, h, 0))
    return `<div class="day-hour${items.length ? '' : ' is-empty'}"><span class="day-hour-key">${label}</span><span class="day-hour-items">${items.join('')}</span></div>`
  })
  .join('')

const board = (open) => `
<section class="day-board${open ? ' is-open' : ''}">
  <button type="button" class="day-line" aria-expanded="${open}">
    <span class="day-line-key">NEXT</span>
    <span class="day-line-label">Physio</span>
    <span class="day-line-time">2:00 pm</span>
    <span class="day-line-more">+4</span>
    <span class="day-line-chev">${open ? '&#9652;' : '&#9662;'}</span>
  </button>
  ${open ? `<div class="day-open"><div class="day-hours">${hours}</div><div class="day-anytime"><span class="day-hour-key">Anytime</span><span class="day-hour-items">${item('Post the parcel', 'task', true)}${item('Water the plants', 'task', true)}</span></div></div>` : ''}
</section>`

const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>${title}</title><link rel="stylesheet" href="/assets/${css}" /></head>
<body><main class="app-shell">${topbar}${body}${commandBar}</main></body></html>`

writeFileSync(
  'dist/__check.html',
  page('CAVEN — idle', `<div class="stage"><div class="stage-core">${core()}${line('Very good. Dinner with Mum, tomorrow at six.')}</div></div>`),
)
writeFileSync(
  'dist/__check-board.html',
  page('CAVEN — board open', `<div class="stage has-board"><div class="stage-board">${board(true)}</div><div class="stage-core">${core('on', 'listening')}${line('Listening&hellip;')}</div></div>`),
)
console.log(`dist/__check.html and dist/__check-board.html → ${css}`)
