# CAVEN — Personal J.A.R.V.I.S. Web App

> **Superseded for persona and voice.** Current product rules live in `AGENTS.md` and `shared/cavenSystem.ts`. CAVEN is a dry London old hand, not a valet. Voice auto-replies. Do not restore “1–3 short sentences / no filler / mock-data only.”

## Context

The user wants a personal assistant web app (a "JARVIS from Iron Man" called **CAVEN**), targeted at **iPhone (iOS, e.g. 13 Pro Max) Safari** as a mobile web app. It is explicitly **not** a business tool — it exists to make everyday life easier, with a focus on people with ADHD / autism / auADHD: reminders, goals, tasks, and morning/night/other routines.

The experience is **voice-first and single-screen**: an animated glowing "core" (arc-reactor style, matching the attached Iron Man HUD reference images) sits at the center. Talking to CAVEN moves the core through visible states, and answering a request slides a relevant **card** from the back to center (macOS-style red/yellow/green traffic-light controls at top-right). There are four pages: **Main board**, **Finance**, **Journal**, and **CAVEN Brain**.

The user asked us to build the **framework** — the full UI, animation state machine, and mock-data-driven cards — and wire real voice with a demo fallback. Real AI/backend is out of scope for this pass.

Confirmed decisions:
- Voice: **Web Speech API (real mic) with a demo/simulated fallback** for iOS Safari and unsupported browsers.
- Scope: **All four pages** built now, using realistic mock data.

## Aesthetic

Driven by the attached reference images (these take precedence): Iron Man / J.A.R.V.I.S. HUD.
- Deep near-black background (#05070d), subtle grid/vignette, faint circuit texture.
- **Neon cyan/electric-blue only** as the glow accent (#3fd0ff / #7fe9ff), exactly as the reference. **No gold/amber.**
- Neutral **metallic** tones for structure and surfaces — brushed gunmetal / graphite / cool steel (#8a95a5, #b8c2ce, #2a3038) for ring bezels, borders, and widget chrome, letting the cyan neon read as the only color.
- Alerts/emphasis stay within the cyan family (brighter/whiter cyan) rather than introducing a second hue.
- Clean, **neat "widget" styling**: tidy rounded glass panels, consistent padding, aligned grids, restrained glow — polished like iOS widgets, not busy.
- Thin luminous rings, radial tick gauges, monospace + geometric type. Font: a techy geometric sans (e.g. `Orbitron` for the core/labels, `Rajdhani` or `Inter` for body) via Google Fonts `@import` in `src/index.css`.
- Glow via layered `box-shadow`/`drop-shadow`; metallic surfaces via subtle steel gradients + `backdrop-blur` glass panels.
- Mobile-first layout (~390–430px viewport) but responsive up to desktop.

## Core interaction model — the CAVEN state machine

A single state enum drives both the core animation and the app flow:
`idle → listening → thinking → acting → speaking → complete → idle`

Core visual per state (all CSS/framer-motion animations on the central orb):
- **Idle**: slow breathing scale + soft pulsing glow.
- **Listening**: expands, ring reacts dynamically to mic amplitude (Web Audio `AnalyserNode`) or a synthesized waveform in demo mode.
- **Thinking**: inward-rotating particles / energy rings.
- **Acting**: sharp, precise energetic motion (fast concentric pulses).
- **Speaking**: core reacts to speech synthesis (amplitude-ish pulsing while `speechSynthesis` speaks, or timed pulses in demo).
- **Complete**: single controlled flash/pulse, then settle to idle.

The states `LISTENING / THINKING / ACTING / SPEAKING` are shown as a labeled status readout that transitions with the core.

## Architecture / files

Keep the documented structure. Entry stays `src/main.tsx` → `src/App.tsx`. Add:

- `src/index.css` — add Google Font `@import` (first), font-family defaults, CAVEN CSS custom properties (colors, glows), keyframe animations for the core states, grid/vignette background.
- `src/App.tsx` — top-level shell: holds `cavenState`, active page, and the active card stack; renders background, core, status readout, card layer, and bottom page navigation.
- `src/lib/cavenState.ts` — the state machine: types, a `useCaven()` hook that sequences states, and a `runCommand(text)` that maps a spoken/typed phrase to (a) a state sequence and (b) a card to surface. Simple keyword routing (e.g. "remind"/"dinner" → reminder card, "spend"/"budget" → finance card, "journal"/"felt" → journal entry).
- `src/lib/voice.ts` — Web Speech API wrapper: `SpeechRecognition` for input (with feature-detect + graceful fallback), `speechSynthesis` for output, and a Web Audio amplitude meter for the listening animation. Exposes a `supported` flag so the UI can show a **demo button** when unavailable.
- `src/lib/mockData.ts` — realistic mock data for all four pages (habits, tasks, calendar/reminders, voice notes, finance transactions/budgets, journal entries, and CAVEN Brain summaries: interests, hobbies, satisfaction/happiness/goal levels).
- `src/components/CavenCore.tsx` — the animated orb + rings + status label, prop-driven by state and amplitude.
- `src/components/CardLayer.tsx` + `src/components/Card.tsx` — the sliding-card system: cards enter from the back (scale/translateZ/opacity) and land center-stage; macOS traffic-light controls (red = dismiss, yellow = fullscreen, green = minimize to a dock chip). Managed as a small stack.
- `src/components/cards/` — one card component per content type: `ReminderCard`, `TaskBoardCard`, `HabitsCard`, `CalendarCard`, `VoiceNoteCard`, `FinanceCard`, `JournalCard`, `BrainCard`.
- `src/components/PageNav.tsx` — bottom nav switching Main / Finance / Journal / CAVEN Brain.
- `src/components/pages/` — `MainBoard.tsx` (habits, tasks, calendar, voice notes summary tiles around the core), `FinancePage.tsx`, `JournalPage.tsx`, `BrainPage.tsx`.
- `src/components/CommandBar.tsx` — mic button + text input fallback so everything is reachable without voice; triggers `runCommand`.

Animation library: add **framer-motion** (`motion`) for the card slide/stack and core transitions (widely used, plays well with React 19). Install before use.

## Behavior details
- Tapping the mic (or the core) starts listening → transcribes → runs the state sequence → surfaces the matching card on `complete`.
- If Web Speech is unsupported (typical iOS Safari), show a subtle "Demo" affordance: pick a scripted command, run the full animated sequence, and speak via `speechSynthesis` if available (else silent).
- Cards stack: newest center; older ones recede behind. Green minimizes to a dock chip at the bottom that can be tapped to restore.
- All content is mock/local state; no persistence required this pass (optionally `localStorage` for created reminders/journal entries — nice-to-have).

## Verification
- Rely on Vite hot reload (dev server already running on `$PORT`); no manual start.
- Manually verify in the preview at a mobile width: core breathes at idle; mic button (or demo) runs listening→thinking→acting→speaking→complete with matching animations and status label; a card slides in from back to center; traffic-light buttons dismiss/fullscreen/minimize; bottom nav switches between all four pages and each renders its mock content.
- Confirm graceful fallback when `SpeechRecognition` is absent (demo path still runs the full sequence).
- Only run a build/typecheck if a real error surfaces during manual checks.
