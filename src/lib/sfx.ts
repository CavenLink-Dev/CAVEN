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
// Mute is global and covers everything audible: interface blips, CAVEN's own
// spoken replies (see voice.ts) and the ambient music (see MusicMenu). Anything
// that plays audio should either check isMuted() at play time or subscribe here
// so it can stop something already in flight.
type MuteListener = (muted: boolean) => void;
const muteListeners = new Set<MuteListener>();
export function setMuted(v: boolean) {
  if (muted === v) return;
  muted = v;
  for (const listener of muteListeners) {
    try {
      listener(v);
    } catch {
      /* a bad listener must never break muting */
    }
  }
}
export function isMuted() {
  return muted;
}
export function onMuteChange(listener: MuteListener): () => void {
  muteListeners.add(listener);
  return () => muteListeners.delete(listener);
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
