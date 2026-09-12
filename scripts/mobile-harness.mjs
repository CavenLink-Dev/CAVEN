// Writes dist/__mobile-check.html — a static page carrying the real class names
// and the real compiled stylesheet, for checking the phone layout without a
// signed-in session standing in the way. Throwaway: `pnpm build` clears dist,
// so re-run this after each build. Not shipped, not referenced by the app.
import { readdirSync, writeFileSync } from 'node:fs'

const css = readdirSync('dist/assets').find((f) => /^index-.*\.css$/.test(f))
if (!css) throw new Error('build dist first')

const panel = (label, rows) =>
  `<section class="glass-panel holo-board holo-in"><h2 class="hud-label hud-label--large text-cyan-100">${label}</h2><div class="board-list-scroll">${rows
    .map((r) => `<p class="t-body">${r}</p>`)
    .join('')}</div></section>`

writeFileSync(
  'dist/__mobile-check.html',
  `<!doctype html><html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>CAVEN responsive check</title><link rel="stylesheet" href="/assets/${css}" /></head>
<body><main class="app-shell">
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
</header>
<div class="save-strip" role="alert"><span>Your board changed in another tab. Reload to catch up.</span><button type="button">Reload board</button><button type="button">Dismiss</button></div>
<div class="board-grid">
  <div class="board-left">${panel('Daily overview', ['Now &middot; Ring the dentist', 'Next &middot; Physio 2:00 pm'])}${panel('Tasks', ['Post the parcel', 'Water the plants'])}</div>
  <div class="board-center"><div class="board-center-msgs"></div><div class="core-zone"><div style="width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,#0af,#023)"></div></div></div>
  <div class="board-right">${panel('Today Calendar', ['2:00 pm Physio', 'tomorrow 10:00 am UX audit check'])}${panel('Reminders', ['Tablets &middot; Monday &middot; every weekday'])}</div>
</div>
<div class="command-bar"><form class="flex-1"><input class="caven-text-input metal-surface h-9 w-full rounded-full px-3 text-sm" placeholder="Say something to CAVEN" /></form></div>
</main></body></html>
`,
)
console.log(`dist/__mobile-check.html → ${css}`)
