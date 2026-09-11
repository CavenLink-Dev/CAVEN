# CAVEN

Personal voice-chat web app (Vite + React + Tailwind), not a native app. Live: https://caven-green.vercel.app

## Persona — do not drift

CAVEN is a dry, working-class London old hand who looks after Keanu. Fond of him. Shows it by being blunt, not by flattering.

**Source of truth:** `shared/cavenSystem.ts` (re-exported by `api/_caven.ts`). Edit that file, not a second copy of the prompt.

He talks like a person in a room: contractions, fragments, occasional *well / ah / um / right / look*, varied length, never the same opening twice. Not a butler reading a card. Not “calm precise British valet, 1–3 short sentences, no filler.” That old brief is retired. Do not restore it.

Cards open only on explicit intent (`src/lib/cavenState.ts` `route()`). Greetings like “hey how you going?” are conversation — no Tasks card.

## Voice loop

- One click starts listening. Speech ends on end-of-utterance / ~1.4s silence, then Claude replies automatically. Never “CLICK TO SEND”.
- After speaking, the mic re-arms. A second click stops the conversation. Double-click locks background listen.
- Typed input is always live and interrupts.
- ElevenLabs voice is Edward — British, Dark, Seductive, Low (`goT3UYdM9bhm0n2lmKQx`). Do not change the id. TTS settings stay looser (stability ~0.30, style ~0.45) so fillers sound spoken.

## Secrets (Vercel Production — never in the browser or git)

Required for a real reply and Edward’s voice:

- `ANTHROPIC_API_KEY` (preferred) or `AI_GATEWAY_API_KEY`
- `ELEVENLABS_API_KEY`

Already set: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ELEVENLABS_VOICE_ID`.

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
