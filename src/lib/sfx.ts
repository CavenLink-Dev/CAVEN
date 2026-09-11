// Sound effects. All kept very quiet by default.

const URLS = {
  select: new URL('../imports/select_sound.mp3', import.meta.url).href,
  start: new URL('../imports/tap_to_start_open_sound.mp3', import.meta.url).href,
  off: new URL('../imports/tap_to_off_end_sound.mp3', import.meta.url).href,
  success: new URL('../imports/success_activate_sound.mp3', import.meta.url).href,
  notification: new URL('../imports/notification_sound.mp3', import.meta.url).href,
  fade: new URL('../imports/fading_off.mp3', import.meta.url).href,
} as const;

export type SfxName = keyof typeof URLS;

// Per-sound volumes — subtle.
const VOL: Record<SfxName, number> = {
  select: 0.05,
  start: 0.16,
  off: 0.15,
  success: 0.18,
  notification: 0.15,
  fade: 0.14,
};

let muted = false;
export function setMuted(v: boolean) {
  muted = v;
}
export function isMuted() {
  return muted;
}

// Throttle rapid repeats (e.g. hover) so it never gets noisy.
const lastPlayed: Partial<Record<SfxName, number>> = {};

export function playSfx(name: SfxName, throttleMs = 0) {
  if (muted) return;
  const now = Date.now();
  if (throttleMs && now - (lastPlayed[name] ?? 0) < throttleMs) return;
  lastPlayed[name] = now;
  try {
    const a = new Audio(URLS[name]);
    a.volume = VOL[name];
    a.play().catch(() => {});
  } catch {
    /* ignore */
  }
}
