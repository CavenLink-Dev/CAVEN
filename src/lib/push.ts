// Notifications — the browser half.
//
// Two separate things, often confused:
//   showLocalNotification  the open tab, backgrounded, telling you something.
//   enablePush             registering with the browser's push service so a
//                          reminder reaches you with no tab open at all.
// Both are best-effort. A browser that refuses either is a browser CAVEN still
// works in; nothing here may throw its way out into a render.

import { notificationBody, type DueReminder } from '../../shared/reminders';
import { apiFetch } from './backend';

export type PushState = 'unsupported' | 'needs-home-screen' | 'denied' | 'off' | 'on';

const SW_URL = '/sw.js';

export function notificationsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/**
 * Safari on iOS and iPadOS grants web push only to a site the user has added to
 * their Home Screen — there is no way to ask for it from a normal tab. Saying
 * so is the only honest answer; offering a switch that silently cannot work is
 * exactly the sort of thing this pass is meant to remove.
 */
export function needsHomeScreen(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator as { maxTouchPoints?: number }).maxTouchPoints! > 1);
  if (!iOS) return false;
  const installed =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  return !installed;
}

/** The open-but-not-looked-at tab speaking up. On screen, the board is the notice. */
export function showLocalNotification(reminder: DueReminder, now: Date): void {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;
    new Notification(reminder.title, { body: notificationBody(reminder, now), tag: `caven:${reminder.id}` });
  } catch {
    // A browser that declines to show it is not an error worth surfacing.
  }
}

/**
 * VAPID keys travel as base64url; PushManager wants raw bytes.
 * Typed as ArrayBuffer rather than Uint8Array because that is what
 * applicationServerKey accepts — a Uint8Array over a SharedArrayBuffer would not.
 */
function decodeKey(base64url: string): ArrayBuffer {
  const padded = base64url.padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), '=');
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return buffer;
}

export async function pushState(): Promise<PushState> {
  if (!notificationsSupported()) return needsHomeScreen() ? 'needs-home-screen' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_URL);
    const subscription = await registration?.pushManager.getSubscription();
    return subscription ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

export type PushResult = { ok: boolean; reason?: string };

export async function enablePush(): Promise<PushResult> {
  if (needsHomeScreen()) {
    return {
      ok: false,
      reason: 'On an iPhone, add CAVEN to your Home Screen first — Safari only allows notifications there.',
    };
  }
  if (!notificationsSupported()) {
    return { ok: false, reason: 'This browser has no support for notifications.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'Your browser refused permission. Nothing has changed.' };
  }

  try {
    // The key is public by design, but it lives in one place on the server so a
    // rotation does not need a rebuild of the front end.
    const keyRes = await apiFetch('push');
    const { publicKey } = (await keyRes.json()) as { publicKey?: string };
    if (!publicKey) {
      return { ok: false, reason: 'Push is not configured on the server yet, so I cannot arm it.' };
    }

    const registration = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
    await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(publicKey),
      }));

    const saved = await apiFetch('push', {
      method: 'POST',
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    if (!saved.ok) {
      // Don't leave a subscription the server has no record of — it would
      // deliver nothing and still read as "on".
      await subscription.unsubscribe().catch(() => {});
      return { ok: false, reason: 'I could not record this device. Do try once more.' };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'Arming notifications failed.' };
  }
}

export async function disablePush(): Promise<PushResult> {
  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_URL);
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return { ok: true };
    await apiFetch('push', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => undefined);
    await subscription.unsubscribe();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'Standing them down failed.' };
  }
}
