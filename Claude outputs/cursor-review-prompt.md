# Pre-commit review — CAVEN accounts/private-boards branch

Before committing the accounts rewrite (AccountGate, supabase.ts, shared/actions.ts, the caven_boards migration, and the api/_caven.ts, api/state.ts, api/chat.ts, store.tsx changes that go with it), fix these. Each of these was checked directly against the working tree — not guesses.

## 1. Blocking: api/chat.ts doesn't compile against the new auth contract

`api/_caven.ts` now requires `loadCavenState(req)` (it authenticates the caller and scopes the board to that user). `api/state.ts` was already updated to match. `api/chat.ts` was not — it still has a leftover `loadBoard()` helper calling `loadCavenState()` with zero arguments:

```ts
// api/chat.ts, ~line 310 — broken
async function loadBoard(): Promise<{ present: boolean; brief: string }> {
  try {
    const state = await loadCavenState();   // needs req, has none
```

Fix: give `loadBoard(req: Request)` the request and thread it through from `handler(req)` at both call sites (the GET health probe and the POST chat path). There's already a second, correct call at line ~362 (`await loadCavenState(req)`) to match against — use that pattern.

Run `pnpm build` (now `tsc --noEmit && vite build`) and confirm it's actually green before committing. It isn't right now.

## 2. tsconfig.json never checked api/ or shared/

`"include": ["src", "vite.config.ts"]` — the backend has never been type-checked, which is exactly how #1 shipped invisibly. Change to:

```json
"include": ["src", "api", "shared", "vite.config.ts"]
```

`@types/node` is already a devDependency so this shouldn't need anything else. Confirm `pnpm build`'s new `tsc --noEmit` step actually catches backend errors after this change — right now it can't.

## 3. Dead, diverging copy of the system prompt

`supabase/functions/server/caven_system.ts` contains a full second copy of `CAVEN_SYSTEM` — the old formal-butler, "no filler, complete sentences" version that was specifically replaced this session. It's not imported by anything findable, but if it or that Edge Function ever gets wired up, the persona silently reverts. Either delete the file, or make it `export { CAVEN_SYSTEM } from "../../../shared/cavenSystem"` like `api/_caven.ts` does. One source of truth, no exceptions — `shared/cavenSystem.ts`.

## 4. Reminder "push alert" copy promises something that doesn't exist yet

`shared/actions.ts` sends this back on every reminder: *"Push alerts require notifications to be enabled on this device."* The schema is there (`caven_reminders`, `caven_push`, `claim_caven_reminders()`), `web-push` is a dependency — but nothing calls `claim_caven_reminders()` or `web-push.sendNotification` anywhere in the codebase yet. No cron, no Edge Function, no sender.

Either: (a) build the actual sending path — a scheduled Supabase Edge Function or Vercel Cron that polls `claim_caven_reminders()` and sends via `web-push` using VAPID keys — and test it end to end, or (b) drop that line from the confirmation message until it's real. Don't ship a promise the system can't keep.

## 5. Confirm intentional: action confirmations bypass the LLM/persona entirely

`shared/actions.ts` returns hardcoded strings ("Task saved, sir.", "Journal entry saved, sir.") for every actual write, and `cavenState.ts` speaks that string directly — `askCaven` (the persona) only runs for pure conversation. This is likely the right call for correctness (never let the model claim a save succeeded when it didn't), so don't change the mechanism. But the strings themselves don't reflect the persona work just done — flat, repeating "X, sir." every time, when the brief was varied acknowledgements and never the same shape twice. Worth a pass to make these read like CAVEN rather than a form.

## 6. Minor: EDWARD_VOICE lost its env override

Old: `process.env.ELEVENLABS_VOICE_ID ?? "goT3UYdM9bhm0n2lmKQx"`. New `api/_caven.ts`: hardcoded to the literal id, no env fallback. Probably fine since the voice isn't changing, but worth restoring the override pattern for next time it needs to move.

## 7. Confirm data-continuity UX is intentional

The migration revokes `anon`/`authenticated` access to the old `kv_store_3159d1b2` table, and `AccountGate.tsx` tells the user: *"Your previous shared board is preserved privately. It is not automatically assigned to a new account."* That means on first sign-up, existing task/habit/journal data does not carry over automatically. Confirm that's the intended launch behavior — if not, write a one-time claim step that attaches the pre-existing board to the first account created.

---

Once #1 and #2 are fixed and `pnpm build` is green, this is in good shape to commit. Treat #3 and #4 as blocking too — a persona regression and an unkept promise are both the kind of thing that undoes work already done. #5–7 are judgment calls surfaced so nothing ships by accident rather than by decision.
