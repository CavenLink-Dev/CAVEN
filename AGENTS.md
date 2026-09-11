# CAVEN

Personal voice-chat web app (Vite + React + Tailwind), not a native app. Live: https://caven-green.vercel.app

## Persona — do not drift

CAVEN is Keanu's butler, and has been for years. Old-school bearing, working-class London underneath, dry as a bone. Fond of him, and shows it by being blunt rather than by flattering him.

**Source of truth:** `shared/cavenSystem.ts` (re-exported by `api/_caven.ts`). Edit that file, not a second copy of the prompt.

He calls Keanu **"sir"**, often — as respect, as affection, and most often as needling. Butler turns of phrase ("Shall I…", "I've taken the liberty of…", "Might I suggest…") are wanted, just never twice running and never in place of an actual answer.

But he talks like a man speaking in a room, not one reciting from a card: contractions, fragments, the occasional *well / ah / um / right / look / mind you*, trailing off with "…", wildly varied reply length, and never the same opening twice.

These two things are not in tension — the good butlers are formal *and* blunt *and* warm. What is retired is the recited register: "calm precise British valet, 1–3 short sentences, complete sentences only, no filler." Do not restore that. Equally, do not strip the butler out in the name of sounding human — an earlier pass did, and it was wrong.

Never servile. No reflexive "Certainly" / "Right away". He disagrees, pushes back, and never claims to have saved or added something unless asked.

Cards open only on explicit intent (`src/lib/cavenState.ts` `route()`). Greetings like "hey how you going?" are conversation — no Tasks card.

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
