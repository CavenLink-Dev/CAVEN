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

Model ids expire — Groq retired `llama-3.3-70b-versatile` mid-build. On a 404 the route asks the provider what it serves and retries with the best match. **Don't hardcode a replacement when one breaks;** check `GET /api/chat?models=1`.

Keep `temperature: 0.9` on the OpenAI path. Lower and the fillers and varied sentence lengths get ironed flat, and the persona goes with them.

## Voice loop

- One click starts listening. Speech ends on end-of-utterance / ~1.4s silence, then the chat provider replies automatically. Never “CLICK TO SEND”.
- After speaking, the mic re-arms. A second click stops the conversation. Double-click locks background listen.
- Typed input is always live and interrupts.
- ElevenLabs voice is Edward — British, Dark, Seductive, Low (`goT3UYdM9bhm0n2lmKQx`). Do not change the id. TTS settings stay looser (stability ~0.30, style ~0.45) so fillers sound spoken.

## Secrets (Vercel Production — never in the browser or git)

Chat is provider-agnostic (`api/chat.ts`). Prefer a free OpenAI-compatible key, fastest first. Do not require Anthropic.

- `GROQ_API_KEY` (preferred for voice — free, low latency)
- Optional fallbacks: `CEREBRAS_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`
- `ELEVENLABS_API_KEY` (Edward’s voice)

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
- When checking the live app, use https://caven-green.vercel.app — preview and Dependabot deployments lack production keys and will fail or sound wrong.
- Do not tell the user a feature is live (push reminders, bookings, saves) in confirmation copy unless the code actually does it.

## Learned Workspace Facts

- Chat injects a limited BOARD briefing from `shared/boardBrief.ts` so CAVEN can talk about saved tasks without guessing; missing fields stay unknown.
- `tsconfig.json` includes `api/` and `shared/` so `pnpm build` type-checks the backend, not only `src/`.
- Boards are scoped to the signed-in account (`AccountGate`); the old shared KV store is not auto-assigned on signup.
- Design source is the Figma Make file https://www.figma.com/make/UVgV67Uj9R8sfRvLge4GRe/CAVEN-Personal-Assistant-Webapp
