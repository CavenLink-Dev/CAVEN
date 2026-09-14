// "Stay with me for twenty minutes."
//
// Sitting with someone is mostly not talking. This holds a deadline and two
// short lines, and deliberately has no notion of a prompt, a check-in or a
// nudge: a companion that pipes up every few minutes is not company, it is an
// egg timer with opinions. Nothing here touches push — a closed tab is not
// someone to sit with.

import { numberIn } from './numbers.ts';

const ASKS_TO_STAY =
  /\b(?:stay with me|stay here with me|keep me company|sit with me|stick with me|stay on(?: the line)? with me)\b/i;

/** No length given. Long enough to be worth asking for, short enough not to linger. */
const DEFAULT_MINUTES = 20;
const MAX_MINUTES = 8 * 60;

/** How long he asked for, in minutes, or null when he wasn't asking. */
export function asksToStay(said: string): number | null {
  if (!ASKS_TO_STAY.test(said)) return null;

  if (/\bhalf an hour\b/i.test(said)) return 30;
  if (/\ban hour and a half\b/i.test(said)) return 90;

  const count = numberIn(said);
  if (/\bhours?\b/i.test(said)) return clamp((count ?? 1) * 60);
  if (/\b(?:minutes?|mins?)\b/i.test(said)) return clamp(count ?? DEFAULT_MINUTES);
  if (/\ban hour\b/i.test(said)) return 60;

  return DEFAULT_MINUTES;
}

function clamp(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes < 1) return DEFAULT_MINUTES;
  return Math.min(Math.round(minutes), MAX_MINUTES);
}

/** A stretch of time as a person says it. */
export function spanLabel(minutes: number): string {
  if (minutes === 30) return 'half an hour';
  if (minutes === 60) return 'an hour';
  if (minutes === 90) return 'an hour and a half';
  if (minutes % 60 === 0) return `${minutes / 60} hours`;
  return `${minutes} minutes`;
}

/** Said once, on being asked. Then quiet. */
export function stayingLine(minutes: number): string {
  return `I'll be here. ${spanLabel(minutes)[0]!.toUpperCase()}${spanLabel(minutes).slice(1)}.`;
}

/** Said once, when the time is up. Then cleared. */
export function elapsedLine(minutes: number): string {
  return `That's ${spanLabel(minutes)} gone.`;
}
