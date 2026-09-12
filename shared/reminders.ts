// When a reminder is due, what to say, and what to write back afterwards.
//
// A reminder that came due simply stayed an ordinary row on the list — nothing
// announced it, in the app or out of it. This module is the part of that both
// the open tab and the push dispatcher have to agree on, so it is pure and kept
// out of both of them.

import { clockLabel, dateLabel, momentLabel, nextOccurrenceIn, parseStamp, type Repeat } from './when.ts';

export type DueReminder = {
  id: string;
  title: string;
  date: string;
  time: string;
  dueAt?: string;
  repeat?: Repeat;
  firedAt?: string;
  /** The zone the reminder was set in. Only the server needs it. */
  timezone?: string;
};

/** Announcing an occurrence more than once is worse than announcing it late. */
export function isDue(reminder: DueReminder, now: Date): boolean {
  const due = parseStamp(reminder.dueAt);
  if (!due || due.getTime() > now.getTime()) return false;
  const fired = parseStamp(reminder.firedAt);
  return !fired || fired.getTime() < due.getTime();
}

/** The one reminder to announce next: the oldest thing still owed. */
export function nextDue(reminders: readonly DueReminder[], now: Date): DueReminder | null {
  let best: { row: DueReminder; at: number } | null = null;
  for (const row of reminders) {
    if (!isDue(row, now)) continue;
    const at = parseStamp(row.dueAt)?.getTime() ?? 0;
    if (!best || at < best.at) best = { row, at };
  }
  return best?.row ?? null;
}

/** Late is said as late. Pretending a reminder is "now" when it is six hours old is a lie. */
const RECENT_MS = 30 * 60 * 1000;

/** Spoken in the browser only, so the machine's own zone is the user's zone. */
export function dueLine(reminder: DueReminder, now: Date, term: string): string {
  const due = parseStamp(reminder.dueAt);
  if (!due) return `${reminder.title}, ${term}.`;
  if (now.getTime() - due.getTime() <= RECENT_MS) return `${term.charAt(0).toUpperCase()}${term.slice(1)} — ${reminder.title}.`;
  return `${reminder.title}, ${term}. That one was due ${momentLabel(due, now)}.`;
}

/**
 * What the board should hold once an occurrence has been announced.
 *
 * A one-off is stamped and left on the board, so it reads as dealt with rather
 * than vanishing. A repeating one is rolled on to its next occurrence — which is
 * the whole point of a repeat, and what "every weekday" never did.
 */
export function settle(reminder: DueReminder, now: Date, zone = reminder.timezone): DueReminder {
  const firedAt = now.toISOString();
  const due = parseStamp(reminder.dueAt);
  if (!reminder.repeat || !due) return { ...reminder, firedAt };
  // `zone` is what keeps the delivery worker, which runs in UTC, from deciding
  // that a 9am Adelaide weekday reminder falls on a Sunday.
  const next = nextOccurrenceIn(due, reminder.repeat, now, zone);
  return {
    ...reminder,
    firedAt,
    dueAt: next.toISOString(),
    date: dateLabel(next, zone),
    time: clockLabel(next, zone),
  };
}

/**
 * Short line for an OS notification, where there is no room for manners.
 *
 * No "today" or "tomorrow" here: this is the one line that gets composed on the
 * server, in UTC, and a relative day worked out in the wrong zone is exactly the
 * kind of quiet wrongness the rest of this change set is about. A clock time in
 * the user's own zone says everything it needs to.
 */
export function notificationBody(reminder: DueReminder, now: Date, zone = reminder.timezone): string {
  const due = parseStamp(reminder.dueAt);
  if (!due || now.getTime() - due.getTime() <= RECENT_MS) return 'Reminder from CAVEN';
  return `Due at ${clockLabel(due, zone)}`;
}
