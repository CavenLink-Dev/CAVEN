// "What am I doing first?" and "Read me the day", answered off the board.
//
// These two go through the model today, which means every asking of them costs
// tokens and carries the standing risk that it fills a quiet morning in with
// something plausible. An empty board has to stay empty out loud — CAVEN once
// volunteered "your streak's been slipping" to a man with no habits saved, and
// nothing here may ever do that again. Every word below comes off a real row.
//
// Pure, so `pnpm test` can hold it to Adelaide fixtures. Rows carry both a human
// string (`time`, `date`) and an ISO stamp (`at`, `dueAt`): print the string,
// compare on the stamp — see shared/when.ts.

import type { CavenData } from '../src/lib/store';
import { clockLabel, dayKey, dayLabel, parseStamp } from './when.ts';

/** "What am I doing first?" — a nudge, not a reading of the whole list. */
export const ASKS_FIRST_TASK =
  /\b(?:what(?:'?s| is) first|what(?:'?s| is) my first|what (?:am i|should i|do i) (?:doing|do|tackle|start) first|what do i do first|where do i start|what should i start (?:with|on))\b/i;

/** "Read me the day" — the whole shape of it, briefly. */
export const ASKS_FOR_THE_DAY =
  /\b(?:read (?:me )?(?:the|my) day|run me through (?:the|my) day|what does (?:the|my) day look like|how does (?:the|my) day look|how(?:'?s| is) (?:the|my) day(?: looking)?|what(?:'?s| is) my day like|brief me on (?:the|my) day)\b/i;

/** Spoken when the board has nothing for today. It must stay sayable and honest. */
const EMPTY_DAY = 'Nothing saved for today.';

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Capital letter, full stop. Board titles are stored however he said them. */
function sentence(body: string): string {
  const said = body.trim().replace(/[.\s]+$/, '');
  if (!said) return '';
  return `${said[0]!.toUpperCase()}${said.slice(1)}.`;
}

/**
 * When a row happens, as a person would say it.
 *
 * The stored human string is what gets spoken, so "6:26pm" stays the way he
 * typed it; the stamp is only ever used to work out which day that is. Today is
 * left unnamed — "at six" rather than "today at six" — because naming it is how
 * a briefing starts to sound like a train announcement.
 */
function whenSpoken(at: Date | null, time: string, now: Date): string {
  const clock = time || (at ? clockLabel(at) : '');
  const day = at ? dayLabel(at, now) : 'today';
  if (day === 'today') return clock ? `at ${clock}` : '';
  return clock ? `${day} at ${clock}` : day;
}

/**
 * The answer to "what am I doing first?" — the task itself, said as one line.
 *
 * Null when nothing is open, so the caller can hand the turn to the model rather
 * than answering a richer question with a blunt "nothing".
 */
export function firstTaskLine(data: Pick<CavenData, 'tasks'> | null | undefined): string | null {
  const task = firstTask(data);
  return task ? sentence(task) : null;
}

/** The one open task to put in front of him, or null when there is none. */
export function firstTask(data: Pick<CavenData, 'tasks'> | null | undefined): string | null {
  const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
  for (const task of tasks) {
    if (!task || task.done) continue;
    const title = trimmed(task.title);
    if (title) return title;
  }
  return null;
}

/** The next thing in the diary, today or ahead. Undated rows are old, and were all saved as today. */
function nextEvent(data: Partial<CavenData>, now: Date) {
  const today = dayKey(now);
  return (Array.isArray(data.calendar) ? data.calendar : [])
    .map((row) => ({ row, at: parseStamp(row?.at) }))
    .filter(({ row, at }) => trimmed(row?.title) && (!at || dayKey(at) >= today))
    .sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0))[0];
}

/** The next reminder waiting, by the stamp where there is one. */
function nextReminder(data: Partial<CavenData>, now: Date) {
  const today = dayKey(now);
  return (Array.isArray(data.reminders) ? data.reminders : [])
    .map((row) => ({ row, at: parseStamp(row?.dueAt) ?? parseStamp(row?.date) }))
    .filter(({ row, at }) => trimmed(row?.title) && (!at || dayKey(at) >= today))
    .sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0))[0];
}

/**
 * The day in one to three short sentences.
 *
 * Missing pieces are left out rather than announced — a man with no diary does
 * not need to be told he has no diary three times. When there is genuinely
 * nothing, it says so, and that is the whole answer.
 */
export function readTheDay(data: Partial<CavenData> | null | undefined, now = new Date()): string {
  if (!data) return EMPTY_DAY;

  const parts: string[] = [];

  const event = nextEvent(data, now);
  if (event) {
    const when = whenSpoken(event.at, trimmed(event.row.time), now);
    parts.push(sentence([trimmed(event.row.title), when].filter(Boolean).join(' ')));
  }

  const reminder = nextReminder(data, now);
  if (reminder) {
    const when = whenSpoken(reminder.at, trimmed(reminder.row.time), now);
    parts.push(sentence(`a reminder to ${[trimmed(reminder.row.title), when].filter(Boolean).join(' ')}`));
  }

  const task = firstTask(data as Pick<CavenData, 'tasks'>);
  if (task) parts.push(sentence(`${task} is still on your list`));

  return parts.length ? parts.join(' ') : EMPTY_DAY;
}
