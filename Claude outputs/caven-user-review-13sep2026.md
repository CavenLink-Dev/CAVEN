# CAVEN — user review, 13 September 2026

Reviewed as a user at `https://caven-green.vercel.app`, then every claim verified
against the source (`~/Downloads/CAVEN` @ `cfe7dff`) and the Supabase project
(`egtzpvitcgquzppvlcrj`). Signed in as `keanudallas151@gmail.com`.

Nothing below is inferred from reading code alone — each item says how it was
confirmed. A short list of things that **looked** broken but weren't is at the
end, so you don't chase them.

---

## 0. The single root cause

Most of the damage traces to one thing, so it's worth stating separately.

- **CAVEN speaks the model's prose as if it were the outcome, whether or not any action ran.**
- In `src/lib/cavenState.ts`:
  ```js
  const { spoken, actions } = parseActions(raw)
  line = spoken
  if (!actions.length) { if (!line) line = OFFLINE_LINE(...); return }  // ← speaks, having done nothing
  ...
  const result = await perform(actions)
  changed = result.changed
  if (!line) line = result.message      // ← model prose OUTRANKS the action's real message
  ```
- Two holes:
  1. A reply that **claims a change with zero actions** is spoken verbatim.
  2. When actions do run, the action layer's truthful message is only used **if the model said nothing**.
- The `catch` branch is well built — it discards the model's line and speaks the real error. But a **silent no-op is not an error**, so it never fires.
- `shared/cavenSystem.ts` forbids this by instruction ("Never claims to have logged/saved/added anything"), and Settings → Help promises the user "he will not claim to have done anything he hasn't". A prompt cannot enforce this.
- **Fix:** make it structural. Only the action layer may assert a change. If `actions.length === 0`, or `result.changed === false`, a reply asserting a mutation must not be spoken. Prefer `result.message` over `spoken` for any turn that mutated state.

---

## 1. P0 — blocking

### 1.1 CAVEN confirms deletions that never happen

- **Repro:** typed *"Delete the reminder that says hey there can you please set a reminder."*
- **Said:** `Removed.`
- **Actually happened:** nothing. `caven_boards.version` stayed at `11`; the row is still in `state->'reminders'`; no `POST /api/state` was issued (network captured).
- **Tell:** `Removed.` is not a string the app can produce. `shared/actions.ts` `reminder.delete` returns ``` `${target.title} is off the board. Say undo if that was wrong.` ``` — so the line came from the LLM, not the action layer.
- Same class as §0.

### 1.2 Signup is broken for every new user

- Supabase returns `429 {"code":"over_email_send_rate_limit","message":"email rate limit exceeded"}` on `POST /auth/v1/signup`.
- Supabase's built-in mailer is capped at a couple of sends per hour **project-wide**. Multiple attempts over the session, all refused. No account was created.
- UI shows **"Too many attempts. Please try again shortly."** — blames the user, and "try again" is the one action that makes a rate limit worse. (An earlier build in the same session showed the even less useful *"Something went wrong. Please try again."*)
- Email confirmation is **on** — `auth.users` shows real accounts confirming ~17s after creation, so a signup that did get through still can't sign in until the link is clicked.
- **Fix:** configure custom SMTP (Resend / Postmark / SES) in Supabase Auth. Optionally surface the provider's `code` rather than a category guess.

### 1.3 Nothing can be deleted or edited without voice

- No delete, edit, or dismiss affordance exists on **any** row anywhere in the live UI — verified by grep across `src/components` and by walking every page.
- Tasks can only be toggled done/undone. Reminders, events, notes, journal entries: nothing.
- The only delete path is spoken/typed — which is the path in §1.1 that lies.
- **Consequence today:** my board had 4 items and 2 were junk I could not remove.
- **Fix:** row-level delete (swipe on mobile, hover-X on desktop) wired to the existing `lastDeleted` undo. Highest value-per-hour item on this list.

### 1.4 Junk records are written from utterances CAVEN didn't understand

Live examples, both currently in your data:

| Stored as | Should have been |
|---|---|
| Reminder *"Hey there can you please set a reminder"*, today 6:00pm | a question: "Remind you of what, and when?" |
| Reminder *"Delete the reminder titled check the UX audit. It is the audit reminder for  on the board."*, today 6:26pm | a **deletion** |
| Task *"Put on some old friends"* | a music request |

- The regex fast path is correct — `shared/actions.ts:104` throws `What date and time should I remind you…? Nothing has been saved yet.` when no certain hour is present.
- But `cavenState.ts` then **hands the turn to the model**, which invents a title (the raw utterance) and a time (6:00pm).
- The 12 Sep audit fixed "delete creates a record" on the **fast path only**. The model path still does it — the second row above is proof, created today.
- **Fix:** constrain the model path the way the fast path is constrained. A `reminder.add` whose `title` is ~the entire utterance, or whose time the user never supplied, should become a question rather than a row.

### 1.5 Stale reminders fire hours or days late

From `public.caven_reminders`:

| Title | Due (UTC) | Delivered (UTC) | Late by |
|---|---|---|---|
| Hey there can you please set a reminder | 13 Sep 08:30 | 13 Sep 08:30:09 | **9 s** ✅ |
| Go to the gym | 12 Sep 09:00 | 12 Sep 22:51 | **13 h 51 m** |
| QA scheduled reminder | 11 Sep 09:20 | 13 Sep 05:36 | **~44 h** |

- The dispatcher claims anything past-due and undelivered, so arming a device flushes the whole backlog at once.
- "Go to the gym" was due 6:30pm Friday and arrived 8:21am Saturday. For an ADHD tool this is worse than silence — it trains you to ignore the notification channel.
- **Fix:** skip anything more than ~15 min stale; mark it `missed` and surface it in-app as "you missed this" instead of pushing it.

### 1.6 The board and the push queue have drifted apart

- `caven_boards.state->'reminders'` — **3** rows: `call the bank`, `Hey there can you please set a reminder`, `Go to the gym`.
- `public.caven_reminders` — **5** rows: the three above **plus** `QA scheduled reminder` and `Delete the reminder titled check the UX audit…`.
- Two reminders exist **only** in the delivery table. They will push, and they appear nowhere in the app, so they cannot be seen, edited or cancelled.
- At time of review, *"Delete the reminder titled check the UX audit. It is the audit reminder for  on the board."* was scheduled to fire at 6:26pm today.
- **Fix:** one source of truth. Either derive `caven_reminders` from the board on every save (delete-and-reinsert), or make the board a view over it. Add a reconciliation on load.

---

## 2. P1 — should fix soon

### 2.1 No icons at all

- `GET /apple-touch-icon.png` → **404**
- `GET /icon-192.png` → **404**
- `manifest.webmanifest` has **no `icons` array** (confirmed: name, short_name, description, start_url, scope, display, background_color, theme_color, orientation — that's all)
- No `<link rel="icon">` in `<head>` — only the manifest and the stylesheet.
- **Consequences:** generic globe in the tab; Chrome/Android won't offer "Install" (needs 192 + 512); iOS Home Screen gets a screenshot tile.
- **This blocks your flagship feature** — iOS only permits notifications from a Home-Screen-installed PWA, which is exactly the step Settings tells the user to take.

### 2.2 A first-time user has no idea what to say

- The signed-in screen is a greeting, an unlabelled glowing orb, an empty text box, and a nav bar. Nothing states that you can talk to it or what it understands.
- The orb's `aria-label` is good ("Click to start talking, click again to stop, double-click for background") — but there is no visible equivalent.
- Meanwhile the **best copy in the app** is buried at More → Help:
  - *"Remind me to take the tablets every weekday at nine."*
  - *"Add ring the dentist to my list." — "Tick ring the dentist off."*
  - *"Put physio in the diary tomorrow at two."*
  - *"I spent twelve pounds on lunch."*
  - *"Make a note: the spare key is in the drawer."*
  - *"What have I got on today?"* / *"Undo."*
- **Fix:** put three of those under the core whenever the board is empty. Hide once anything exists.

### 2.3 No send button

- `App.tsx` wraps a single `<input>` in a `<form>` with **no submit button** anywhere in the command bar.
- Enter works (implicit submission, one field), and mobile keyboards show "Go" — but there is no visible way to send, and no fallback if Enter is intercepted.

### 2.4 Stale-build breakage

- A deploy landed mid-review: the loaded chunk `index-B-PD5_kL.js` began returning **404** while the tab was open, and the app silently stopped working until reload.
- No service worker was registered at any point during the session (`navigator.serviceWorker.getRegistrations()` → `[]`), so nothing catches this.
- **Fix:** a "new version available — reload" prompt, or a SW that serves the last good build.

### 2.5 Mobile touch targets are under-size

Measured at 375×812:

| Nav item | Size |
|---|---|
| Caven | 33 × **26** px |
| Mission Control | 94 × **26** px |
| Journal | 45 × **26** px |
| Brain | **33 × 26** px |
| More ▾ | 38 × **26** px |

- WCAG 2.5.5 and Apple HIG both want ≥ 44 px. These are the controls tapped most often.

### 2.6 Supabase security advisories

- `auth_leaked_password_protection` **disabled** — WARN. One toggle; checks new passwords against HaveIBeenPwned.
- `rls_enabled_no_policy` on `public.kv_store_3159d1b2` — RLS on, zero policies. Harmless while unused, but see §3.3.

---

## 3. Remove

### 3.1 Dead components (~700 lines)

Nothing imports these except each other — verified by grep:

- `src/components/board/TasksCard.tsx`
- `src/components/board/RemindersCard.tsx`
- `src/components/board/CalendarCard.tsx`
- `src/components/board/DailyOverviewCard.tsx`
- `src/components/board/GlassPanel.tsx` (only imported *by* the four above)

Ironically `TasksCard` contains the only per-row `remove(task)` handler in the codebase — the affordance §1.3 asks for already exists, in a file nothing renders.

### 3.2 The Wellbeing rings on Brain

- `brainMetrics` has **no writer anywhere** — grep across `src`, `shared` and `api` finds only reads plus the empty seed and the `api/state.ts` field list.
- It can never say anything but "Nothing tracked yet."
- Either implement it or drop the section.

### 3.3 The legacy `caven:state` row

- `public.kv_store_3159d1b2` still holds the pre-auth global board: tasks named `Hmm`, `etst`, `Hello there`, `Can you hear me`, `Hello how are you`, and a reminder titled `Please make me an appointment tomorrow or a reminder tomorrow at 6 p.m. dinner with Mom`.
- Useful as a museum piece of the old fall-through-to-Tasks bug; not useful in production. Drop the row and the table.

### 3.4 Duplicate reply rendering

- The spoken line renders twice off the main page: once in the `sr-only` live region and once in `.page-reply`. Screen readers get it twice.

---

## 4. Add

- **Row delete / edit** (§1.3) — the single biggest win.
- **Icons**: 192, 512, maskable, apple-touch-icon, favicon (§2.1).
- **Example prompts on the empty state** (§2.2).
- **A "missed" state** for reminders that passed undelivered, instead of a late push (§1.5).
- **Reminder snooze / mark-done** — *"Go to the gym · yesterday"* has sat overdue with no way to resolve it.
- **`og:image`** — link previews are currently title + description on a blank card.
- **Custom SMTP** (§1.2).
- **Onboarding for a fresh account** — still the outstanding item from the 12 Sep audit, and now the only path in is broken anyway.

---

## 5. Small things

- Password minimum is 8 (`minLength={8}`, correctly set) but it is **never stated** — you discover it via a native browser tooltip on submit.
- "Forgot your password?" is rendered on the **Create account** tab as well as Sign in.
- The mute button's live `aria-label` reads **"Mute microphone"**; it actually mutes voice, music and effects. (Local `App.tsx` already has the better string — the deployed build is behind.)
- Asking *"what is on today"* answers aloud ("Just dinner with your mother at six.") but **does not raise the board**, though `App.tsx` intends to.
- The Voice section says **"Hayes, a calm British voice"**; the project notes say the ElevenLabs voice is **"Edward"**. One of the two is stale.
- Settings shows an **ARM** button even when it has just told you the browser has blocked notifications and it can't be undone from the page.
- `robots.txt` is `Disallow: /` and the page is `noindex, nofollow`. Correct for a private app — flagging only so it's a decision, not an accident.
- `/api/chat` diagnostics report a single provider configured: `groq / qwen/qwen3.8-27b`. No fallback keys set, so a Groq outage or another model retirement takes chat down.

### Latency (measured, warm)

| Call | Time |
|---|---|
| `POST /api/chat` | 1.5 – 1.9 s |
| `POST /api/tts` | 1.4 – 2.0 s |
| `POST /api/state` | 1.8 s |

- ~3.4 s from pressing send to first audio. Acceptable, but it is dead silence — an earcon on send, or streaming TTS, would cover it.

---

## 6. What's genuinely good

- **The persona lands.** *"Just dinner with your mother at six."* is exactly right — not a form letter.
- **Push delivery is accurate when the reminder is fresh** — 9 seconds late. The hard part works.
- **The Settings copy is unusually honest**, especially Integration: *"CAVEN keeps his own board and does not read or write anywhere else yet… it will ask before the first sync."*
- **Empty states are in character** — *"No entries yet. The first one is always the hardest."*
- **Password reset doesn't leak account existence** — same reply either way, deliberately, with a comment saying so.
- **Auth form hygiene**: correct `autocomplete` values, secrets cleared on mode switch, a hard 12s timeout on the session check so a hanging fetch can't strand you.
- **The two-tab conflict fix from 12 Sep works** — the save strip offers "Reload board", not just Dismiss.
- **`shared/when.ts`** did its job: "tomorrow at 9am" produced `2026-09-13 23:30Z` = 9:00am Adelaide on the 14th. Correct, including the half-hour offset.
- **The code comments are excellent** — they explain *why*, and several saved me time here.

---

## 7. Checked, and NOT bugs

Recording these so they don't get chased:

- **Enter not submitting** — reproduced on a synthetic control form on the same page, so it's an automation-harness limitation, not CAVEN.
- **Mission Control rendering washed out / unreadable** — that's the `anim-fade-up` entrance mid-flight. It settles correctly.
- **Content unreachable behind the dock** — the document scrolls (the inner `.page-scroll` doesn't), and the last section clears the dock by ~20px at full scroll.
- **"Good afternoon" at 5:48pm** — it switched to "Good evening" at 6:01pm. Correct.
- **Nav clicks needing two attempts** — `elementFromPoint` confirms the buttons are the hit target with nothing overlaying; harness quirk.
- **Signup creating stray accounts** — it didn't. `auth.users` shows no rows from any of my attempts.

---

## 8. Suggested order

1. §0 / §1.1 — stop CAVEN claiming actions he didn't take. Root cause of §1.1 and §1.4.
2. §1.3 — row delete + edit. Makes every remaining mis-capture recoverable.
3. §1.2 — custom SMTP. Nobody else can use the app until this is done.
4. §1.6 then §1.5 — one source of truth for reminders, then drop stale pushes.
5. §2.1 — icons. Cheap, and it unblocks iOS install → iOS push.
6. §2.2 — example prompts on the empty state.
7. §3 — delete the dead code and the legacy row.
