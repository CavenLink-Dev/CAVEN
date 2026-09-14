# Migrations — read this before writing one

**This folder is not a complete record of the database.** Four migrations are
applied to the live project and have no file here, so `create or replace` on any
function in this folder can silently revert work that only exists in production.
Check the deployed definition first:

> Applied on 12 Sep 2026, and present here: `20260912114206_reminder_delivery`
> (recorded as `20260912101500_reminder_delivery.sql` — the filename predates the
> apply) and `20260912224518_schedule_caven_push_dispatch`. Both were applied
> from this session and verified afterwards: the cron job's first run returned
> `200 {"ok":true,"claimed":0,"sent":0,"pruned":0}`.

```sql
select pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = '<function>';
```

## Applied but not in this folder (as of 12 Sep 2026)

| Version | Name | What it did |
|---|---|---|
| 20260911081226 | `reminder_delivery_hardening` | Installed `pg_cron` and `pg_net`. Added a unique index on `caven_push(endpoint)` so one device subscription cannot belong to two accounts. Rewrote `claim_caven_reminders()` to claim only reminders whose user has a registered device, ten at a time rather than fifty. |
| 20260911081354 | `configure_caven_reminder_dispatch_secret` | Created a vault secret named `caven_cron_secret`. **Its value is not recorded here and must not be.** |
| 20260911081523 | `temporary_caven_validation_accounts` | QA accounts. |
| 20260911082025 | `immediate_save_conflicts` | Changed `save_caven_board`'s conflict `errcode` from `40001` to `PT409`, so PostgREST maps it straight to an HTTP 409. |

That last one had a consequence worth knowing about. `api/state.ts` went on
checking for `40001`, which the function no longer raised, so every save conflict
came back as a plain 503 "Save failed. Please retry." — a retry that could not
succeed. That is the dead end the 12 Sep UX audit hit on its two-tab test. The
route now accepts both codes.

Also note the base migration's timestamp differs: this folder has
`20260911063533_private_boards_and_reminders.sql`, the database records it as
`20260911063856`. Same content; the file was never renamed.

## Rules that follow from all this

- Read the deployed definition before replacing a function, and carry forward
  anything the repo does not know about. `20260912101500_reminder_delivery.sql`
  keeps `PT409` and leaves `claim_caven_reminders()` alone for exactly that reason.
- Never write a secret into a migration file. Reference it by vault name.
- When you apply a migration by hand, add the file here in the same sitting.

## 20260914000000_drop_legacy_kv_store.sql — not yet applied

Drops `public.kv_store_3159d1b2`, the pre-auth single-row global board. Nothing
has read it since private boards landed on 11 Sep, and it is the last thing
holding the security linter's `rls_enabled_no_policy` finding open.

Apply it by hand in the SQL editor (or `supabase db push`) — it was written
locally on 14 Sep and deliberately not run against production from here.
