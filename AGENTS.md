# CAVEN

Personal voice-chat web app (Vite + React + Tailwind), not a native app. Live: https://caven-green.vercel.app

## Persona — do not drift

CAVEN's character: butler in manner, adviser in judgement, father figure in concern, military man in efficiency, dry Englishman in humour. An original character with that flavour — not an impression of Alfred, Jeeves, or anyone real.

**Source of truth:** `shared/cavenSystem.ts` (re-exported by `api/_caven.ts`). Edit that file, not a second copy of the prompt.

He says "sir" — not in every line, respect comes from tone and competence more than address. ~85% plain modern English, ~15% refined/old-fashioned phrasing (very good, of course, leave it with me, I'll see to it, I'm afraid, quite, perhaps). Acknowledgements vary — never the same one twice running. Dry, restrained humour only when he's procrastinating or stating the obvious, never during anything serious.

He serves Keanu's interests, not just his instructions — pushes back on a poor call, respectfully, once, with the reason. Never insults, patronises, or agrees just to please him. Never claims something is done/booked/saved unless it actually is.

**He does not know Keanu's data** — no tasks, habits, streaks, calendar, money or history unless stated in the conversation. Never invent it (an earlier build had him say "your streak's been slipping" out of nowhere — that must never recur).

Never: "Absolutely!", "Amazing!", "Certainly, sir" as a reflex, Victorian flourishes, robotic confirmations, excessive enthusiasm. No markdown/emoji/bullets/stage directions — every word is spoken aloud.

Cards open only on explicit intent (`src/lib/cavenState.ts` `route()`). Greetings like "hey how you going?" are conversation — no Tasks card.

**Token budget matters.** This prompt is resent every turn and free provider tiers meter tokens per minute (Groq's free tier: 8000 TPM). Keep the system prompt lean — verified live that ~850 tokens/turn exhausts the budget in ~4 messages. Current prompt is ~540 tokens.

## Chat providers

`api/chat.ts` is a provider table tried fastest-first, not a single hardcoded model. Set any of `GROQ_API_KEY` (free, fastest), `CEREBRAS_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `CHAT_BASE_URL`+`CHAT_API_KEY`, `ANTHROPIC_API_KEY`, `AI_GATEWAY_API_KEY`. Extra keys act as automatic fallbacks.

Model ids expire — Groq retired `llama-3.3-70b-versatile` mid-build. On a 404 the route asks the provider what it serves and retries with the best match. **Don't hardcode a replacement when one breaks;** check `GET /api/chat?models=1`. Current default: `qwen/qwen3.8-27b` (verified live). Override with `GROQ_MODEL`.

Keep `temperature: 0.9` on the OpenAI path. Lower and the fillers and varied sentence lengths get ironed flat, and the persona goes with them.

## Voice loop

- One click starts listening. Speech ends on end-of-utterance / ~1.4s silence, then the chat provider replies automatically. Never “CLICK TO SEND”.
- After speaking, the mic re-arms. A second click stops the conversation. Double-click locks background listen.
- Typed input is always live and interrupts.
- ElevenLabs voice is George — British premade (`JBFqnCBsd6RMkjVDRZzb`). Library voices such as Edward (`goT3UYdM9bhm0n2lmKQx`) and James (`xru6qZB94sJdkyqP12qN`) return 402 on a free ElevenLabs plan. `api/tts.ts` retries George if the env id is still a library voice. TTS settings stay looser (stability ~0.30, style ~0.45) so fillers sound spoken.

## Secrets (Vercel Production — never in the browser or git)

Chat is provider-agnostic (`api/chat.ts`). Prefer a free OpenAI-compatible key, fastest first. Do not require Anthropic.

- `GROQ_API_KEY` (preferred for voice — free, low latency)
- Optional fallbacks: `CEREBRAS_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`
- `ELEVENLABS_API_KEY` (George’s voice)

Already set: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_API_KEY`.

OpenAI-compatible calls use `temperature: 0.9` so the spoken persona does not flatten.

`GET /api/chat` is a health probe: which providers are configured, no secret values.

## Figma Make scaffold

React + Vite + Tailwind CSS project that can still run inside Figma Make.

## Development Server

A Vite development server is **already running** on `$PORT` (default 8443). You don't need to start it manually.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Primary application component and the usual starting point for UI work
- `src/index.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx`
- `package.json` - Project dependencies and the Vite build, development, preview, and formatting scripts
- `vite.config.ts` - Vite configuration with React, Tailwind CSS v4, and Figma Make plugins plus the `@` alias for `src`
- `.mise.toml` - Toolchain versions for Node.js and pnpm

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `src/index.css` imports Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization in `src/index.css`. This scaffold does not need a Tailwind config file or PostCSS config.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

## Learned User Preferences

- Do not restore autoplay ambient or looping background audio; that bed was removed on purpose. Optional MusicMenu tracks are fine unless asked otherwise.
- Spoken replies should sound human (contractions, occasional fillers). Do not revive the old "no filler, complete sentences only" valet prompt.
- When checking the live app, use https://caven-green.vercel.app — preview and Dependabot deployments lack production keys and will fail or sound wrong. In v0 / Figma Make, `/api` should hit that origin too.
- Do not tell the user a feature is live (push reminders, bookings, saves) in confirmation copy unless the code actually does it.
- Do not invent HUD, calendar, or widget numbers; an empty board stays empty.

## Learned Workspace Facts

- Chat injects a limited BOARD briefing from `shared/boardBrief.ts` so CAVEN can talk about saved tasks without guessing; missing fields stay unknown.
- `tsconfig.json` includes `api/` and `shared/` so `pnpm build` type-checks the backend, not only `src/`.
- Boards are scoped to the signed-in account (`AccountGate`); the old shared KV store is not auto-assigned on signup.
- Live board UI is the upgraded_board JARVIS 3-column layout (CavenCore, Settings, MusicMenu in the top bar). Original design file: https://www.figma.com/make/UVgV67Uj9R8sfRvLge4GRe/CAVEN-Personal-Assistant-Webapp
- `pnpm run dev` is `scripts/dev.mjs`: if 8443 already has Vite, keep it (Figma Make/v0 starts a second `dev` after writing `.env`). `/api` proxies to `pnpm dev:api` (`vercel dev` on :3000) locally, or to https://caven-green.vercel.app in v0/Figma Make sandboxes.
- Keep `ACTION_VERBS` in `shared/actions.ts` and the verb list in `shared/cavenSystem.ts` in lockstep — a verb missing from the prompt is never spoken.
- Do not set `letter-spacing` on unlayered `.font-display`; Tailwind v4 utilities lose to unlayered CSS. Family only, inside `@layer` (`tests/fontDisplay.test.ts`).
- Dates live in `shared/when.ts` and nowhere else. Every "is this today?", "is this this month?" and "when does this repeat next?" answers from there, so the action engine, the board cards and the BOARD briefing cannot disagree. Rows carry both a human string (`date`, `time`, `when`) and an ISO stamp (`at`, `dueAt`): print the string, compare on the stamp. Older rows have no stamp and `parseStamp` reads their en-AU date instead — never `Date.parse` on `dd/mm/yyyy`, which is a different day on a US-locale build.
- A habit's tick is `lastDone` (a local YYYY-MM-DD), never the `done` flag — nothing clears that flag overnight. Use `habitDoneOn()`.
- Removal never takes the regex fast path. `REMOVAL` in `shared/actions.ts` turns a delete phrase away in both `applyCommand` and `route()`, because "delete the reminder for 6:26pm" matches the reminder intent on the words "reminder for" and used to answer by saving a second one.
- `pnpm test` pins `TZ=Australia/Adelaide`. Every fixture is written in +09:30 and the app reasons in local days, so without it the suite only passes on a machine already in that zone.
- Reminders are delivered twice over and must settle identically: `src/lib/cavenState.ts` sweeps every 20s while the tab is open, `api/push-dispatch.ts` sends to closed tabs. Both go through `shared/reminders.ts`, so a repeating one rolls on exactly once.
- The delivery worker runs in UTC. Anything it computes about a user's day must go through `nextOccurrenceIn(..., zone)` — 9am Monday in Adelaide is 23:30 Sunday in UTC, and a UTC `getDay()` lands a weekday rule a day late every week. Never compose a relative day ("today", "tomorrow") server-side.
- Push needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `CAVEN_CRON_SECRET` in Vercel — all already set on Production. The secret is `CAVEN_CRON_SECRET`, not `CRON_SECRET`: Vercel reserves that name for its own scheduler, and the route accepts it only as a fallback. It must equal the `caven_cron_secret` vault secret in Supabase. `pnpm vapid` prints a fresh pair, but rotating invalidates every browser subscription, so don't without reason.
- `vercel.json` declares no cron. A Hobby plan reduces a job to daily, which is no use to a reminder due at 6:26pm, and a schedule that cannot do its job is worse than none. `supabase/scheduling.sql` schedules it from pg_cron every minute instead. iOS grants web push only to a site added to the Home Screen; `needsHomeScreen()` says so rather than offering a switch that cannot work.
- `GET /api/push-dispatch` (with the secret header) is a health probe like `GET /api/chat`: what is configured, how many devices are registered, how many reminders are waiting. It sends nothing and returns no secret. `POST` is what dispatches.
- Anything under `shared/` that an `api/` route reaches must be imported **without** the `.ts` extension. The Edge bundler will not resolve an explicit `.ts` specifier and fails the deploy with `The Edge Function "api/chat" is referencing unsupported modules` — *after* a green build. `pnpm build` cannot catch this because it only runs `tsc --noEmit && vite build` and never bundles the functions. `npx vercel build --prod` does; run it before pushing anything that changes an `api/` import graph. (`shared/actions.ts` still uses `.ts` specifiers and is fine — no api/ route imports it.)
- `public/sw.js` is delivery only and deliberately caches nothing: a stale board served offline is worse than an honest failure.
- Never hide the nav to make a breakpoint fit. It was `display:none` below 680px, which left four of the five pages unreachable on a phone. It wraps to its own full-width row instead.
- Sizes that a breakpoint has to change cannot be inline styles — inline beats a media query. The top bar's marks, avatar, clock and music offset are classes in `index.css` for exactly that reason; keep them there.
- Panel drag and resize are pointer-only (`e.pointerType === 'touch'` returns early). The press-and-hold that arms a drag would otherwise eat the scroll gesture and leave a phone stuck on the first panel.
- `node scripts/mobile-harness.mjs` writes `dist/__mobile-check.html` after a build — the real class names against the real compiled stylesheet, with no signed-in session in the way, for checking the phone layout. Throwaway; `pnpm build` clears it.
