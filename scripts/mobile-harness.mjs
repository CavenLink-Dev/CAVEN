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

const topbar = (title = 'Good morning, Sir') => `
<header class="topbar">
  <div class="topbar-lead">
    <h1 class="topbar-greeting">${title}</h1>
    <p class="topbar-date">Sunday 13 September</p>
  </div>
  <div class="topbar-side">
    <time class="topbar-clock">10:35am</time>
    <div class="relative">
      <button type="button" class="flex items-center gap-2 rounded-full px-3 py-1.5 metal-surface">
        <span class="font-display t-micro tracking-[0.2em]">MUSIC</span>
      </button>
    </div>
  </div>
</header>`

const navItem = (label, active = false) =>
  `<button type="button" class="bottom-nav-item${active ? ' is-active' : ''}">${label}</button>`

const bottomNav = (active = 'Caven', menu = false) => `
<nav class="bottom-nav" aria-label="Pages">
  <button type="button" class="bottom-nav-mark"><span style="display:block;width:44px;height:22px;background:#1a3b47;border-radius:4px"></span></button>
  ${['Caven', 'Mission Control', 'Journal', 'Brain'].map((l) => navItem(l, l === active)).join('')}
  <div class="bottom-nav-more">${navItem('More <span class="bottom-nav-caret">&#9662;</span>')}${!menu ? '' : `<div class="bottom-nav-menu" role="menu">${['Settings','Integration','Account','Help'].map((l) => `<button type="button" class="bottom-nav-menu-item">${l}</button>`).join('')}</div>`}</div>
</nav>`

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

const board = (open, line = true) => `
<section class="day-board${open ? ' is-open' : ''}">
  ${!line ? '' : `<button type="button" class="day-line" aria-expanded="${open}">
    <span class="day-line-key">NEXT</span>
    <span class="day-line-label">Physio</span>
    <span class="day-line-time">2:00 pm</span>
    <span class="day-line-more">+4</span>
    <span class="day-line-chev">${open ? '&#9652;' : '&#9662;'}</span>
  </button>`}
  ${open ? `<div class="day-open"><div class="day-hours">${hours}</div><div class="day-anytime"><span class="day-hour-key">Anytime</span><span class="day-hour-items">${item('Post the parcel', 'task', true)}${item('Water the plants', 'task', true)}</span></div></div>` : ''}
</section>`

const row = (label, when, extra = '') => `<div class="mc-row"><span class="day-label">${label}</span><span class="mc-when">${when}</span>${extra}</div>`

// Mission Control: the same sections the page renders, in the same order.
const mission = `
<div class="mc">
  <section class="mc-section" id="today">
    <div class="mc-head"><h2 class="mc-title">Today</h2></div>
    ${board(true, false)}
  </section>
  <section class="mc-section" id="tasks">
    <div class="mc-head"><h2 class="mc-title">Tasks</h2><span class="mc-note">2 open</span></div>
    <div class="mc-rows">
      <button type="button" class="mc-task"><span class="day-tick"></span><span class="day-label">Ring the dentist</span><span class="mc-when">9:00 am</span></button>
      <button type="button" class="mc-task"><span class="day-tick"></span><span class="day-label">Post the parcel</span></button>
      <button type="button" class="mc-task"><span class="day-tick is-done">&#10003;</span><span class="day-label is-done">Water the plants</span></button>
    </div>
  </section>
  <section class="mc-section" id="reminders">
    <div class="mc-head"><h2 class="mc-title">Reminders</h2><span class="mc-note">2</span></div>
    <div class="mc-rows">
      <div class="mc-row is-overdue"><span class="day-label">Tablets</span><span class="mc-when">Yesterday &middot; 6:00 pm</span></div>
      ${row('Dinner with Mum', 'Tomorrow &middot; 6:00 pm &middot; repeats weekly')}
    </div>
  </section>
  <section class="mc-section" id="money">
    <div class="mc-head"><h2 class="mc-title">Money</h2><span class="mc-note">September 2026 &middot; 3</span></div>
    <div class="mc-balance">$-84.20</div>
    <div class="mc-rows mc-budgets">
      <div><div class="mc-row"><span class="day-label">Groceries</span><span class="mc-when">$180 / $400</span></div><span class="mc-bar"><span style="width:45%"></span></span></div>
    </div>
    <div class="mc-rows">
      ${row('Coffee', 'Today', '<span class="mc-amount">-$5.20</span>')}
      ${row('Pay', 'Fri', '<span class="mc-amount is-in">+$420.00</span>')}
    </div>
  </section>
</div>`

const page = (title, body, { head = topbar(), active = 'Caven', menu = false } = {}) => `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>${title}</title><link rel="stylesheet" href="/assets/${css}" /></head>
<body><main class="app-shell">${head}${body}<div class="dock">${commandBar}${bottomNav(active, menu)}</div></main></body></html>`

writeFileSync(
  'dist/__check.html',
  page('CAVEN — idle', `<div class="stage"><div class="stage-core">${core()}${line('Very good. Dinner with Mum, tomorrow at six.')}</div></div>`),
)
writeFileSync(
  'dist/__check-board.html',
  page('CAVEN — board open', `<div class="stage has-board"><div class="stage-board">${board(true)}</div><div class="stage-core">${core('on', 'listening')}${line('Listening&hellip;')}</div></div>`),
)
writeFileSync(
  'dist/__check-mission.html',
  page('CAVEN — mission control', `<div class="page-scroll">${mission}</div>`, {
    head: topbar('Mission Control'),
    active: 'Mission Control',
    menu: true,
  }),
)
console.log(`dist/__check.html, __check-board.html and __check-mission.html → ${css}`)
