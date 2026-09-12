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
// Needs: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET,
// and SUPABASE_SECRET_KEY (already set). `pnpm vapid` prints a fresh key pair.
import webpush from 'web-push';
import { adminDb, json, apiError } from './_caven';
import { notificationBody, settle, type DueReminder } from '../shared/reminders';

type ClaimedRow = {
  user_id: string;
  id: string;
  title: string;
  due_at: string;
  repeat: string | null;
  timezone: string | null;
};

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. A Supabase pg_cron job
 * (the usual route, since a Hobby plan only schedules daily) sends the same
 * secret as `x-caven-cron`. Anything else is a stranger asking us to send push
 * notifications to our own users, so it gets nothing.
 */
function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get('authorization')?.replace(/^Bearer /i, '').trim();
  return bearer === secret || req.headers.get('x-caven-cron')?.trim() === secret;
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

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
      // Not an error: push simply isn't configured yet. Say so plainly rather
      // than reporting a successful run that delivered nothing.
      return json({ ok: false, reason: 'VAPID keys are not configured', claimed: 0, sent: 0 });
    }
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:cavenlink.dev@gmail.com', publicKey, privateKey);

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
