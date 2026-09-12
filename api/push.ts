// The browser's push subscriptions for the signed-in account.
//
//   GET     the VAPID public key, so the client can subscribe. Public by design.
//   POST    record this browser's subscription against this account.
//   DELETE  forget one endpoint (this browser standing itself down).
//
// Delivery itself is api/push-dispatch.ts; this route only keeps the register.
import { authenticate, json, apiError } from './_caven';
export const config = { runtime: 'edge' };

/** A subscription is opaque to us apart from its shape; store it, don't trust it. */
function readSubscription(value: unknown): { endpoint: string; subscription: Record<string, unknown> } | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const endpoint = typeof row.endpoint === 'string' ? row.endpoint.trim() : '';
  if (!endpoint || endpoint.length > 2000 || !/^https:\/\//i.test(endpoint)) return null;
  const keys = row.keys;
  if (!keys || typeof keys !== 'object') return null;
  const { p256dh, auth } = keys as Record<string, unknown>;
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || !p256dh || !auth) return null;
  return { endpoint, subscription: { endpoint, keys: { p256dh, auth } } };
}

export default async function handler(req: Request) {
  try {
    if (req.method === 'GET') {
      // Authenticated so the route stays uniform, though the key is not secret.
      await authenticate(req);
      return json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? '' });
    }

    const { db, user } = await authenticate(req);

    if (req.method === 'POST') {
      const body = await req.json().catch(() => null);
      const parsed = readSubscription((body as { subscription?: unknown } | null)?.subscription);
      if (!parsed) return json({ error: 'Invalid subscription' }, 400);
      const { error } = await db
        .from('caven_push')
        .upsert(
          { user_id: user.id, endpoint: parsed.endpoint, subscription: parsed.subscription },
          { onConflict: 'user_id,endpoint' },
        );
      if (error) return json({ error: 'Could not record this device. Please retry.' }, 503);
      return json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const body = await req.json().catch(() => null);
      const endpoint = typeof (body as { endpoint?: unknown } | null)?.endpoint === 'string'
        ? ((body as { endpoint: string }).endpoint)
        : '';
      if (!endpoint) return json({ error: 'Which device?' }, 400);
      const { error } = await db.from('caven_push').delete().eq('user_id', user.id).eq('endpoint', endpoint);
      if (error) return json({ error: 'Could not stand this device down. Please retry.' }, 503);
      return json({ ok: true });
    }

    return json({ error: 'method_not_allowed' }, 405);
  } catch (err) {
    return apiError(err);
  }
}
