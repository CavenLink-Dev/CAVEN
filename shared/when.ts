// Dates, as CAVEN has to reason about them.
//
// Four separate bugs all came from the same missing idea: the board stored the
// *clock* but never the *day*. A booking for Tuesday landed under Today, a habit
// ticked on Monday was still "already done" on Tuesday, the month balance summed
// every transaction ever, and "every weekday" saved one reminder that fired once.
//
// So: one module, imported by the action engine, the board cards and the model
// briefing alike, and pure enough to test. Everything is LOCAL time — the user
// lives in one place and says "tomorrow at six" meaning their own six.

export type Repeat = 'daily' | 'weekdays' | 'weekly';

const PAD = (n: number) => String(n).padStart(2, '0');

/** Local calendar day as YYYY-MM-DD. The key everything else compares on. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${PAD(date.getMonth() + 1)}-${PAD(date.getDate())}`;
}

/** Local calendar month as YYYY-MM. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${PAD(date.getMonth() + 1)}`;
}

/**
 * Read a stored timestamp back into a Date.
 *
 * New rows carry an ISO `at`/`dueAt`. Rows written before this module existed
 * carry only `toLocaleDateString('en-AU')` — "12/09/2026", day first — so those
 * are parsed too rather than being dropped from every total and every list.
 * Date.parse would read that as 12 September only by luck, and as 9 December on
 * a US locale build, so it is never used for the legacy shape.
 */
export function parseStamp(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;
  const said = value.trim();
  if (!said) return null;

  const auShort = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(said);
  if (auShort) {
    const [, d, m, y] = auShort;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // A bare YYYY-MM-DD is one of our own day keys, so it means that local day.
  // Date.parse would read it as UTC midnight, which is the previous day for
  // anyone west of Greenwich — that is how a habit ticked today reads as
  // yesterday and quietly breaks a streak.
  const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(said);
  if (dayOnly) {
    const [, y, m, d] = dayOnly;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const ms = Date.parse(said);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/** Local day of a stored timestamp, or null when it can't be read. */
export function dayKeyOf(value: unknown): string | null {
  const date = parseStamp(value);
  return date ? dayKey(date) : null;
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/** Whole local days from `now`'s day to `target`'s day. Negative is in the past. */
export function daysBetween(now: Date, target: Date): number {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const to = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((to - from) / 86_400_000);
}

const WEEKDAY = new Intl.DateTimeFormat('en-AU', { weekday: 'long' });
const DAY_MONTH = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long' });

/**
 * How a person would say the day out loud: "today", "tomorrow", "Thursday",
 * "29 September". Spoken by CAVEN and printed on the board, so it never reads
 * as a machine date.
 */
export function dayLabel(target: Date, now = new Date()): string {
  const gap = daysBetween(now, target);
  if (gap === 0) return 'today';
  if (gap === 1) return 'tomorrow';
  if (gap === -1) return 'yesterday';
  if (gap > 1 && gap < 7) return WEEKDAY.format(target);
  if (gap < -1 && gap > -7) return `last ${WEEKDAY.format(target)}`;
  return DAY_MONTH.format(target);
}

/** "Thursday at 6:00 pm" — the spoken form of a whole moment. */
export function momentLabel(target: Date, now = new Date()): string {
  return `${dayLabel(target, now)} at ${clockLabel(target)}`;
}

/** The clock as the board and the voice both render it. */
export function clockLabel(date: Date): string {
  return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
}

// ─── Recurrence ──────────────────────────────────────────────────────────────
// "every weekday at 9am" used to save one reminder, with "every weekday" still
// jammed in the title, that fired once and never again. A repeat rule is three
// shapes and no more: every day, every working day, every <weekday>. Anything
// fancier belongs to a real calendar, and CAVEN says so rather than faking it.

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export type RepeatRule = { repeat: Repeat; weekday?: number };

/** Phrases that mean "repeat", longest first so "every weekday" beats "every day". */
const REPEAT_PATTERNS: { re: RegExp; rule: (match: RegExpExecArray) => RepeatRule }[] = [
  { re: /\bevery (?:single )?(?:week ?day|working day|business day)s?\b/i, rule: () => ({ repeat: 'weekdays' }) },
  { re: /\b(?:on )?week ?days\b/i, rule: () => ({ repeat: 'weekdays' }) },
  {
    re: /\bevery (sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b/i,
    rule: (m) => ({ repeat: 'weekly', weekday: DAY_NAMES.indexOf(m[1]!.toLowerCase() as (typeof DAY_NAMES)[number]) }),
  },
  {
    re: /\b(?:every|each) (sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b/i,
    rule: (m) => ({ repeat: 'weekly', weekday: DAY_NAMES.indexOf(m[1]!.toLowerCase() as (typeof DAY_NAMES)[number]) }),
  },
  { re: /\bevery (?:single )?week\b|\bweekly\b/i, rule: () => ({ repeat: 'weekly' }) },
  { re: /\bevery (?:single )?day\b|\bdaily\b|\beach day\b/i, rule: () => ({ repeat: 'daily' }) },
];

/**
 * The repeat rule a sentence asks for, and the sentence with that phrase lifted
 * out. Removing it matters twice over: chrono then reads "at 9am" as a single
 * clean time, and the leftover words make a title a person would recognise.
 */
export function readRepeat(said: string): { rule: RepeatRule | null; rest: string } {
  for (const { re, rule } of REPEAT_PATTERNS) {
    const match = re.exec(said);
    if (!match) continue;
    const rest = `${said.slice(0, match.index)} ${said.slice(match.index + match[0].length)}`
      .replace(/\s{2,}/g, ' ')
      .trim();
    return { rule: rule(match), rest };
  }
  return { rule: null, rest: said };
}

/** How CAVEN says the rule aloud, and how the board prints it. */
export function repeatLabel(repeat: Repeat, at?: Date): string {
  if (repeat === 'daily') return 'every day';
  if (repeat === 'weekdays') return 'every weekday';
  return at ? `every ${WEEKDAY.format(at)}` : 'every week';
}

/** The next occurrence strictly after `from`, per the rule. */
export function stepOccurrence(from: Date, repeat: Repeat): Date {
  const next = new Date(from.getTime());
  if (repeat === 'weekly') {
    next.setDate(next.getDate() + 7);
    return next;
  }
  next.setDate(next.getDate() + 1);
  if (repeat === 'weekdays') {
    // Saturday and Sunday are skipped, so Friday's next turn is Monday.
    while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
  }
  return next;
}

/**
 * Roll a repeating reminder forward to its first occurrence after `after`.
 * Steps rather than jumps, so a fortnight of missed weekdays lands on a weekday
 * and not on the Saturday the arithmetic would otherwise reach. Bounded, because
 * a stored date from years back must not spin the loop.
 */
export function nextOccurrence(from: Date, repeat: Repeat, after: Date): Date {
  let next = from;
  for (let guard = 0; guard < 800 && next.getTime() <= after.getTime(); guard++) {
    next = stepOccurrence(next, repeat);
  }
  return next;
}

/**
 * Pull a start date onto the rule's own footing. "Every Monday at 9" said on a
 * Wednesday must not first fire on Wednesday, and "every weekday at 6" said on a
 * Saturday must not fire on the Saturday.
 */
export function alignToRule(start: Date, rule: RepeatRule, now: Date): Date {
  let at = new Date(start.getTime());
  if (rule.repeat === 'weekly' && rule.weekday !== undefined) {
    const shift = (rule.weekday - at.getDay() + 7) % 7;
    if (shift) at.setDate(at.getDate() + shift);
  }
  if (rule.repeat === 'weekdays') {
    while (at.getDay() === 0 || at.getDay() === 6) at.setDate(at.getDate() + 1);
  }
  // Aligning can only push forward, but a same-day shift of zero can still leave
  // a moment already gone — step once more so the first fire is always ahead.
  if (at.getTime() <= now.getTime()) at = stepOccurrence(at, rule.repeat);
  return at;
}
