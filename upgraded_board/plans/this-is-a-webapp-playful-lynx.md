# CAVEN — Voice-First AI Assistant Interface (First Build)

## Context

The project is a blank Figma Make scaffold (`src/App.tsx` renders an empty centering
div; `src/index.css` only imports Tailwind and sets full height). Nothing is built yet.

CAVEN is a voice-first personal AI assistant with a calm, British personality. The
centerpiece is an **animated "core"** — a living field of light that reacts to touch,
listening, thinking, speaking, and completing actions. Around it sits a **board**: a
personal dashboard of cards the user can surface by voice.

The user chose a **dark, calm & luminous** look and attached four JARVIS-style HUD
references (`src/imports/*.png|jpeg`). These are **inspiration/vibe + layout reference**:
adopt the near-black canvas, glowing rings, corner-bracket framed panels, symmetric
left/right card columns, central animated core, and a bottom-center voice waveform +
mic command bar. Temper the density — CAVEN must feel calm and low-stimulation
(ADHD/autism-friendly), not a cluttered cockpit. Content is CAVEN's features, not Stark's.

**Scope (confirmed):** the fully-animated CAVEN core as centerpiece + a board shell with
key cards — daily overview, tasks, reminders, calendar — driven by mock data.

## Visual direction & tokens

Define tokens in `src/index.css` via Tailwind v4 `@theme` + CSS custom properties:

- **Canvas:** deep near-black with a subtle radial charcoal vignette (`#06090d` → `#0b1016`).
- **Accent:** restrained luminous cyan/teal (`~#4fd6e0` / `#2ec9d6`) as the core/HUD glow;
  a warmer amber (`~#f5b642`) reserved as a secondary/alert accent (used sparingly, as in refs).
- **Surfaces:** glass cards — low-opacity fill (`rgba(255,255,255,0.03–0.05)`), 1px hairline
  border (`rgba(120,200,220,0.14)`), soft backdrop blur, and **corner-bracket** accents
  drawn with pseudo-elements/SVG (signature of the references).
- **State color language** (consistent, per brief): idle = soft cyan; listening = brighter
  cyan pulse; thinking = slow amber shimmer; speaking = rhythmic cyan waves; success = crisp
  mint-green flash then return to idle.
- **Type:** quiet elegant sans for body/headings + a technical monospace for HUD labels
  (uppercase, letter-spaced, small). Use Google Fonts via CSS `@import` at top of
  `index.css` (per AGENTS.md) — e.g. `Space Grotesk`/`Inter` for UI + `JetBrains Mono` or
  `Geist Mono` for labels. Keep it to two families.
- Respect `prefers-reduced-motion`: reduce the core to a gentle opacity breathe, disable
  particle bursts and heavy ripples.

## Architecture

Keep it lightweight (no router needed for this scope). New files under `src/`:

- `src/App.tsx` — replace empty div with the board layout + providers.
- `src/components/CavenCore/CavenCore.tsx` — the animated core (the marquee piece).
- `src/components/board/` — card components:
  - `TopBar.tsx` (CAVEN wordmark + tagline, system status dot, local time, user chip)
  - `DailyOverviewCard.tsx`, `TasksCard.tsx`, `RemindersCard.tsx`, `CalendarCard.tsx`
  - `GlassPanel.tsx` (shared framed-panel wrapper with corner brackets + section label)
  - `VoiceBar.tsx` (bottom-center waveform + mic command button)
- `src/lib/mockData.ts` — mock tasks, reminders, calendar events, overview summary.
- `src/lib/coreState.ts` — a small typed state machine for core states
  (`idle | listening | thinking | speaking | success`) + a React hook/context so the
  mic button and cards can drive the core.

### CAVEN Core (the centerpiece)

Build with layered SVG rings + CSS/Web Animations, no heavy deps. Layers:

1. Outer HUD rings (concentric, some dashed, slow counter-rotation) — decorative, calm.
2. Mid ring with tick marks / segment arcs that light up on activity.
3. Inner glowing orb with an animated radial gradient that "breathes" (scale + brightness).
4. A ripple layer (expanding rings) triggered on release/activate/success.
5. A lightweight particle burst layer (a handful of dots fading outward) on release —
   keep subtle, gated behind reduced-motion.

Interactions (pointer events, mapped from the brief):

- **Resting:** gentle breathing (scale 0.98↔1.02, glow ebb/flow, ~4s loop).
- **Press down (pointerdown):** core compresses slightly, centre brightens + shifts hue.
- **Release (pointerup):** springs outward, ripple through rings, brief particle burst.
- **Tap to activate:** stronger center→edge pulse, hue shift, enter `listening`.
- **Press & hold:** energy gathers inward, glow intensifies, rings draw in; release → larger burst.
- **While speaking (`speaking`):** rhythmic waves of brightness with natural pauses
  (simulated amplitude driver for now — no real mic capture in this build).
- **Action finished (`success`):** crisp color change + outward pulse, then settle to idle.
- **Tap to stop:** energy contracts, outer light fades, settles.

Use an internal amplitude value (simulated via a small oscillator/`requestAnimationFrame`
loop) to modulate scale/brightness so listening/speaking feel alive without real audio.
Clicking the core cycles idle → listening → thinking → speaking → success → idle to
demonstrate the full state language; the mic button in `VoiceBar` mirrors this.

### Board layout

Follow reference image 4, adapted and calmer:

- Top: `TopBar` (thin, hairline underline).
- Center: `CavenCore` as the hero, generous breathing room around it.
- Left column: `DailyOverviewCard`, `TasksCard`.
- Right column: `CalendarCard`, `RemindersCard`.
- Bottom-center: `VoiceBar` (waveform reacts to core state + "Tap to speak" / status text).
- **Responsive:** CSS grid with `minmax`/`auto-fit`. On narrow widths, columns stack —
  core first, then cards in a single column, voice bar pinned to bottom. Use `clamp()` for
  the core size and type. No fixed desktop-only widths.

### Card content (mock, CAVEN-flavored, calm copy)

- **Daily Overview:** "What matters now / next / can wait" — a few grouped lines + a
  short dry-humored CAVEN line.
- **Tasks:** 3–4 tasks, each with subtasks/steps and a completable checkbox (local state).
- **Reminders:** 2–3 reminders with time + notification status (armed/sent).
- **Calendar:** today's appointments + next up, with a simple free-time hint.

Interactivity: checkboxes toggle task/subtask completion; cards use consistent hover/focus
glow. Keep interactions obvious and gentle.

## Files to modify / create

- Modify: `src/App.tsx`, `src/index.css` (tokens, fonts, keyframes, base canvas).
- Create: `src/components/CavenCore/CavenCore.tsx`, `src/components/board/*.tsx`,
  `src/lib/mockData.ts`, `src/lib/coreState.ts`.
- No changes to `vite.config.ts`, `index.html`, or the harness files.

## Verification

- Dev server is already running on `$PORT`; changes hot-reload. Load the preview and confirm:
  - Core breathes at rest; press/hold/release/tap produce the described reactions and hue/ripple/burst.
  - Mic button and clicking the core both drive the state language (idle→listening→thinking→speaking→success).
  - Cards render mock data; task checkboxes toggle; layout reflows cleanly from wide to narrow.
  - `prefers-reduced-motion` reduces motion to a gentle breathe (test via devtools emulation).
- No console errors in `figma logs` only if something visibly fails.
