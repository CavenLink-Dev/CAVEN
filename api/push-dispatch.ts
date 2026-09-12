// Delivery. The half of reminders that reaches a closed tab.
//
// The schema for this landed months ago — caven_reminders, caven_push,
// claim_caven_reminders() — and nothing ever called it, which is why a reminder
// reached its time and simply sat there. This is the worker that calls it.
//
// Node runtime on purpose: VAPID signing and AES128GCM payload encryption come
// free with `web-push`, and hand-rolling them on the Edge runtime would be a
// large amount of cryptography to get subtly wrong.
//
// Scheduling is external and the route is idempotent by design: the claim takes
// a two-minute lease with `for update skip locked`, so two overlapping runs
// cannot deliver the same occurrence twice.
//
// Needs: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CAVEN_CRON_SECRET,
// and SUPABASE_SECRET_KEY. `pnpm vapid` prints a fresh key pair if one is needed.
//
// GET is a health probe in the manner of GET /api/chat: it says what is
// configured and what is waiting to go out, and sends nothing. POST dispatches.
// Nothing here ever returns a secret value.
// Explicit .js on every relative import. This route runs on the Node runtime,
// where the emitted files are plain ESM and Node will not guess an extension —
// an extensionless specifier fails at invocation with ERR_MODULE_NOT_FOUND,
// long after a green build and a green deploy. The Edge routes get away with it
// because their bundler inlines everything; this one is not bundled that way.
import webpush from 'web-push';
import { adminDb, json, apiError } from './_caven.js';
import { notificationBody, settle, type DueReminder } from '../shared/reminders.js';

type ClaimedRow = {
  user_id: string;
  id: string;
  title: string;
  due_at: string;
  repeat: string | null;
  timezone: string | null;
};

/**
 * The Supabase pg_cron job (the usual route, since a Hobby plan only schedules
 * daily) sends the shared secret as `x-caven-cron`. Vercel Cron sends
 * `Authorization: Bearer` with its own reserved CRON_SECRET, which is accepted
 * too so the vercel.json schedule works on a plan that honours it.
 *
 * CAVEN_CRON_SECRET is the provisioned name and comes first; CRON_SECRET is only
 * the fallback, because Vercel reserves that name for its own scheduler.
 * Anything else is a stranger asking us to notify our own users, so it gets
 * nothing — and if no secret is configured at all, nobody is authorised.
 */
function authorised(req: Request): boolean {
  const secret = process.env.CAVEN_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get('authorization')?.replace(/^Bearer /i, '').trim();
  return bearer === secret || req.headers.get('x-caven-cron')?.trim() === secret;
}

/**
 * Confirm the key pair is usable before trusting it. A malformed or mismatched
 * pair makes setVapidDetails throw, which would otherwise surface as a bare 500
 * every minute and tell nobody what was actually wrong.
 */
function vapidReady(): { ok: boolean; reason?: string } {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return { ok: false, reason: 'VAPID keys are not configured' };
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:cavenlink.dev@gmail.com',
      publicKey,
      privateKey,
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `VAPID keys are not usable: ${err instanceof Error ? err.message : 'unknown'}` };
  }
}

/** 404 or 410 means the browser threw the subscription away; stop writing to it. */
function isGone(error: unknown): boolean {
  const status = (error as { statusCode?: number })?.statusCode;
  return status === 404 || status === 410;
}

export default async function handler(req: Request) {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
    if (!authorised(req)) return json({ error: 'forbidden' }, 403);

    const vapid = vapidReady();

    // Health probe. Says what is configured and what is waiting, sends nothing,
    // and names no secret — the same bargain GET /api/chat makes.
    if (req.method === 'GET') {
      const db = adminDb();
      const { count: waiting } = await db
        .from('caven_reminders')
        .select('id', { count: 'exact', head: true })
        .is('delivered_at', null)
        .lte('due_at', new Date().toISOString());
      const { count: devices } = await db.from('caven_push').select('endpoint', { count: 'exact', head: true });
      return json({
        ok: vapid.ok,
        reason: vapid.reason,
        authorised: true,
        vapidConfigured: vapid.ok,
        registeredDevices: devices ?? 0,
        remindersDue: waiting ?? 0,
      });
    }

    if (!vapid.ok) {
      // Not an error: push simply isn't ready. Say so plainly rather than
      // reporting a successful run that delivered nothing.
      return json({ ok: false, reason: vapid.reason, claimed: 0, sent: 0 });
    }

    const db = adminDb();
    // The deployed claim only returns reminders belonging to a user who has a
    // registered device, ten at a time. So a user who has never armed push has
    // nothing claimed here and nothing advanced — their repeating reminders roll
    // on in the open tab instead, which is the only place they would see them.
    const { data, error } = await db.rpc('claim_caven_reminders');
    if (error) return json({ error: 'Could not claim reminders' }, 503);
    const claimed = (data ?? []) as ClaimedRow[];

    const now = new Date();
    let sent = 0;
    let pruned = 0;

    for (const row of claimed) {
      const reminder: DueReminder = {
        id: row.id,
        title: row.title,
        date: '',
        time: '',
        dueAt: row.due_at,
        repeat: (row.repeat as DueReminder['repeat']) ?? undefined,
        timezone: row.timezone ?? undefined,
      };

      const { data: devices } = await db
        .from('caven_push')
        .select('endpoint,subscription')
        .eq('user_id', row.user_id);

      const payload = JSON.stringify({
        title: row.title,
        body: notificationBody(reminder, now),
        tag: `caven:${row.id}`,
        url: '/',
      });

      for (const device of devices ?? []) {
        try {
          await webpush.sendNotification(device.subscription as webpush.PushSubscription, payload);
          sent++;
        } catch (err) {
          if (!isGone(err)) continue;
          await db.from('caven_push').delete().eq('user_id', row.user_id).eq('endpoint', device.endpoint);
          pruned++;
        }
      }

      // Settle whether or not anyone was subscribed. The occasion has passed
      // either way, and a repeating reminder left un-advanced would be claimed
      // again on the very next run, for ever.
      const settled = settle(reminder, now);
      const moved = settled.dueAt !== reminder.dueAt;
      await db.rpc('settle_caven_reminder', {
        p_user: row.user_id,
        p_id: row.id,
        p_patch: moved
          ? { firedAt: settled.firedAt, dueAt: settled.dueAt, date: settled.date, time: settled.time }
          : { firedAt: settled.firedAt },
        p_next: moved ? settled.dueAt : null,
      });
    }

    return json({ ok: true, claimed: claimed.length, sent, pruned });
  } catch (err) {
    return apiError(err);
  }
}
