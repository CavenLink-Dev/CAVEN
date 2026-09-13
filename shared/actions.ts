// CAVEN's execution engine. Two doors in:
//   applyCommand — the regex fast path called by route() in src/lib/cavenState.ts.
//   runAction    — one structured action the chat model emitted as [[ACT {...}]].
// Both are pure: `prev` is never mutated, and changed:false means nothing was written.
// Every `message` is spoken aloud by TTS, so no markdown, no bullets, no emoji, and
// never a claim larger than what actually happened.
import * as chrono from 'chrono-node';
import type {CavenData} from '../src/lib/store';
// Day, month and repeat arithmetic. Every "is this today?" question in the app
// answers from here, so the board, the briefing and the voice cannot disagree.
import {
  alignToRule,
  clockLabel,
  dayKey,
  dayLabel,
  daysBetween,
  momentLabel,
  parseStamp,
  readRepeat,
  repeatLabel,
  type Repeat,
} from './when.ts';
export type ActionKind='reminder'|'tasks'|'journal'|'voicenote'|'calendar'|'habits'|'finance'|'brain';
export type CavenAction={do:string;[key:string]:unknown};
export type ActionResult={data:CavenData;message:string;changed:boolean};
// Address rules live in shared/address.ts so the Settings field, the voice
// verb and every spoken line agree on one definition of an acceptable term.
import { addressOf, checkAddress } from './address.ts';
// Re-exported so callers keep one import for the action engine's whole surface.
export { addressOf, checkAddress, DEFAULT_ADDRESS, ADDRESS_LIMIT } from './address.ts';
/**
 * Anything that means "take it away".
 *
 * These must never reach the fast path. "Delete the reminder for 6:26pm"
 * matches the reminder intent on the words "reminder for", and the fast path
 * answered by creating a *second* reminder for 6:26pm — the user asked for one
 * fewer record and got one more. Removal needs the model path, which owns
 * reminder.delete / task.delete / event.delete and the findOne() questioning
 * that refuses to guess which record was meant.
 */
export const REMOVAL =
  /\b(delete|remove|cancel|clear|scrap|erase|wipe|bin (?:off|it)|get rid of|take (?:it |that |the )?.{0,40}?\boff\b|no longer (?:need|want))\b/i;

/**
 * A reply that claims a record was created, changed or removed.
 *
 * The model writes CAVEN's spoken line, and it will happily narrate an outcome
 * it never asked for: a plain "Removed." with no [[ACT]] block at all, which the
 * app then said aloud while the row sat exactly where it was. Prompting cannot
 * prevent that — AGENTS.md has said "never claims something is done/saved unless
 * it actually is" throughout — so the claim is detected here and the caller
 * refuses to speak it unless the action engine reports `changed`.
 *
 * Deliberately narrow: it must match a first-person completion ("I've added…"),
 * a definite state ("it's on the board"), or a bare past participle used as a
 * whole sentence ("Removed."). Ordinary conversation that merely contains the
 * word "done" is left alone.
 */
const DONE_WORDS =
  'added|saved|logged|noted|filed|booked|set|put|removed|deleted|cancelled|canceled|cleared|crossed|ticked|taken|scheduled|sorted|done|gone';
const CLAIMS_CHANGE = new RegExp(
  [
    `\\bi(?:'ve| have)\\s+(?:already\\s+|just\\s+)?(?:${DONE_WORDS})\\b`,
    `\\bit'?s\\s+(?:on the (?:board|list)|in the diary|down|done|off)\\b`,
    `\\bthat'?s\\s+(?:done|gone|off|sorted|logged|saved|noted|in)\\b`,
    // "off the board" is only ever a removal claim. Bare "on the list" is not:
    // "Nothing on the list at all" is a truthful report of an empty board, so a
    // placement claim has to be anchored to a subject ("it's…", "dinner is…").
    `\\boff the (?:board|list)\\b`,
    `\\bis (?:on the (?:board|list)|in the diary)\\b`,
    `(?:^|[.!?]\\s+)(?:${DONE_WORDS})[.!]`,
  ].join('|'),
  'i',
);

/** True when `text` tells the user something was created, changed or removed. */
export function claimsChange(text: string): boolean {
  return typeof text === 'string' && CLAIMS_CHANGE.test(text);
}

/** Queries and negations. Viewing and writing are separate operations. */
const READ_ONLY =
  /^(show|what|how|when|where|do i|did i|have i|can you show|tell me|open|check|don'?t (add|save|create|log|delete)|do not)\b/i;

/** The phrasings that ask for a reminder to exist. */
const REMINDER_INTENT = /\b(remind me|set a reminder|reminder for|nudge me|wake me|let me forget)\b/i;

type Reminder = CavenData['reminders'][number];

/** One shape for a stored reminder, so the fast path and the model path agree. */
function makeReminder(id: string, title: string, due: Date, repeat?: Repeat): Reminder {
  const reminder: Reminder = {
    id,
    title,
    date: due.toLocaleDateString('en-AU'),
    time: clockLabel(due),
    dueAt: due.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  if (repeat) reminder.repeat = repeat;
  return reminder;
}

/** What CAVEN says once a reminder is actually on the board. */
function reminderLine(due: Date, now: Date, repeat?: Repeat): string {
  if (!repeat) return `It's on the board for ${momentLabel(due, now)}.`;
  return `On the board ${repeatLabel(repeat, due)} at ${clockLabel(due)}, starting ${dayLabel(due, now)}.`;
}

/** Whatever is left of a sentence once the command words and the date are gone. */
function titleFrom(said: string, cut: { index: number; text: string }): string {
  return (
    `${said.slice(0, cut.index)}${said.slice(cut.index + cut.text.length)}`
      // Collapse first: lifting a date out of the middle leaves a double space,
      // and "remind me  to …" would then not match the "remind me to" prefix,
      // stranding a bare "to" at the front of the title.
      .replace(/\s{2,}/g, ' ')
      .trim()
      .replace(
        /^(?:caven[, ]*)?(?:remind me(?: to)?|set a reminder(?: for)?|nudge me(?: to)?|wake me|don'?t let me forget(?: to)?)\s*/i,
        '',
      )
      .replace(/^(?:to|that|about)\s+/i, '')
      .replace(/\b(at|on|for|to)\s*$/i, '')
      .trim()
  );
}

export function applyCommand(kind:ActionKind,text:string,prev:CavenData,now=new Date()):ActionResult {
 const said=text.trim(), term=addressOf(prev), id=crypto.randomUUID(), day=now.toLocaleDateString('en-AU'), at=now.toISOString(), unchanged={data:prev,message:'Here it is.',changed:false};
 // Queries and negations never mutate data. Viewing and writing are separate operations.
 if(READ_ONLY.test(said)) return unchanged;
 // A removal is never a creation. Hand it to the model path untouched.
 if(REMOVAL.test(said)) return unchanged;
 if(kind==='reminder' && REMINDER_INTENT.test(said)) {
  // Lift any "every weekday" out first: chrono then reads a single clean time
  // instead of tripping over the repeat phrase, and the title keeps only the
  // words a person would recognise as the thing they asked to be reminded of.
  const {rule,rest}=readRepeat(said);
  const match=chrono.en.GB.parse(rest,now,{forwardDate:true})[0];
  if(!match||!match.start.isCertain('hour'))throw new Error(`What date and time should I remind you, ${term}? Nothing has been saved yet.`);
  const due=rule?alignToRule(match.start.date(),rule,now):match.start.date();
  if(due.getTime()<=now.getTime())throw new Error(`That time has already passed, ${term}. Please give me a future date and time.`);
  const title=titleFrom(rest,{index:match.index,text:match.text})||'Reminder';
  return {data:{...prev,reminders:[makeReminder(id,title,due,rule?.repeat),...prev.reminders]},message:reminderLine(due,now,rule?.repeat),changed:true};
 }
 if(kind==='tasks') {
  const done=said.match(/^(?:please )?(?:tick|cross) (.+?) off(?: my (?:list|tasks))?$/i)||said.match(/^(?:complete|finish|mark complete) (.+)$/i);
  if(done){const target=prev.tasks.filter(t=>t.title.toLowerCase()===done[1].toLowerCase());if(target.length!==1)throw new Error(`Please use the exact task name, ${term}. Nothing changed.`);return{data:{...prev,tasks:prev.tasks.map(t=>t.id===target[0].id?{...t,done:true}:t)},message:"That's done.",changed:true};}
  const add=said.match(/^(?:please )?(?:add (?:a |an )?task[: ]*|new task[: ]*|add )(.+?)(?: to my (?:tasks|list))?$/i);
  if(add)return{data:{...prev,tasks:[{id,title:add[1],done:false},...prev.tasks]},message:`Noted: ${add[1]}.`,changed:true};
 }
 if(kind==='journal'&&/^(?:journal[: ]|(?:add|write|save|log)\b)/i.test(said))return{data:{...prev,journal:[{id,date:day,at,mood:'',title:'Journal entry',body:said.replace(/^journal[: ]*/i,'')},...prev.journal]},message:"It's in the journal.",changed:true};
 if(kind==='voicenote'&&/^(?:make|take|save|add|note|jot|remember)\b/i.test(said))return{data:{...prev,voiceNotes:[{id,text:said,when:day,at},...prev.voiceNotes]},message:"I've got that down.",changed:true};
 // Calendar bookings fall through to the model path, which owns event.add.
 return unchanged;
}

type Task = CavenData['tasks'][number];
type Habit = CavenData['habits'][number];
type CalendarEvent = CavenData['calendar'][number];
type Transaction = CavenData['transactions'][number];
type Budget = CavenData['budgets'][number];

/**
 * Whether a habit counts as ticked for the given day.
 *
 * Never read the stored `done` flag on its own: it was written on whatever day
 * the habit was last ticked and nothing ever cleared it overnight, which is why
 * the same habit stayed "already ticked today" indefinitely. `lastDone` is the
 * record; the flag is only kept so older readers of the board still see something
 * sensible. A habit saved before `lastDone` existed reads as not yet done — it
 * costs one streak, once, and is the only reading that can't be wrong tomorrow.
 */
export function habitDoneOn(habit: { done?: boolean; lastDone?: string }, now = new Date()): boolean {
  return habit.lastDone === dayKey(now);
}

/** Every verb runAction understands. The system prompt is kept in step with this list. */
export const ACTION_VERBS: readonly string[] = [
  'task.add',
  'task.done',
  'task.undone',
  'task.delete',
  'undo',
  'reminder.add',
  'reminder.delete',
  'event.add',
  'event.delete',
  'habit.add',
  'habit.done',
  'habit.delete',
  'journal.add',
  'note.add',
  'note.delete',
  'spend.add',
  'budget.set',
  'brain.note',
  'interest.add',
  'address.set',
];

/** Loose value to trimmed string. Numbers are accepted; anything else is empty. */
function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/** A field the action cannot do without. Missing means we stop and ask, never guess. */
function required(value: unknown, complaint: string): string {
  const out = text(value);
  if (!out) throw new Error(complaint);
  return out;
}

/** Command words a person says *around* the thing, never as the thing itself. */
const COMMAND_PREFIX =
  /^(?:(?:hey|hi|hello|ok|okay|yo|caven)[,! ]+)*(?:can |could |would |will |please |i need (?:you )?to |i want (?:you )?to )+/i;
const INTENT_PREFIX =
  /^(?:caven[, ]*)?(?:you\s+)?(?:please\s+)?(?:remind me(?: to)?|set(?: me)? a reminder(?: for| to)?|nudge me(?: to)?|wake me|don'?t let me forget(?: to)?|add|put|book|schedule|make)\s+/i;

/**
 * The title of a record, or a question if what arrived was the sentence itself.
 *
 * The regex fast path refuses an utterance it cannot read a time out of, and
 * then hands the turn to the model — which has been observed to "recover" by
 * calling reminder.add with the whole utterance as the title and a time nobody
 * supplied. Two rows in production came from exactly that: a reminder titled
 * "Hey there can you please set a reminder", and another titled "Delete the
 * reminder titled check the UX audit…" — a *removal* stored as a new record.
 *
 * A title is a thing ("call the bank"), not a request for one. So the command
 * wrapping is stripped, and if what remains is still a command, still empty, or
 * far too long to be a subject, nothing is written and the user is asked.
 */
function subject(value: unknown, noun: string, term: string): string {
  const raw = required(value, `What should I call it, ${term}? Nothing has been saved.`);
  const trimmed = raw.replace(COMMAND_PREFIX, '').replace(INTENT_PREFIX, '').replace(/^(?:to|that|about)\s+/i, '').trim();

  // A removal never becomes a creation, however it is phrased.
  if (REMOVAL.test(trimmed)) {
    throw new Error(`Which ${noun} should go, ${term}? Nothing has been added.`);
  }
  // Still a request rather than a subject: the model handed over the sentence.
  if (!trimmed || REMINDER_INTENT.test(trimmed) || COMMAND_PREFIX.test(trimmed)) {
    throw new Error(`What should the ${noun} say, ${term}? Nothing has been saved.`);
  }
  // A subject is short. A sentence this long is the utterance, not its point.
  if (trimmed.length > 80) {
    throw new Error(`Give me the short version and I'll put it down, ${term}. Nothing has been saved.`);
  }
  return trimmed;
}

/** "12.50", "$12.50", 12.5 all read as 12.5. Anything unreadable reads as null. */
function amountOf(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = text(value).replace(/[^0-9.-]/g, '');
  if (!cleaned || !/\d/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Money as the voice should say it. */
function money(n: number): string {
  const abs = Math.abs(n);
  return `$${Number.isInteger(abs) ? String(abs) : abs.toFixed(2)}`;
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Find the one record the user meant. An exact name wins, case aside; only when
 * nothing matches exactly do partial matches count, and then only if one survives.
 * Zero or several always throws — CAVEN never picks a record on your behalf.
 */
function findOne<T>(rows: readonly T[], label: (row: T) => string, needle: string, noun: string, term: string): T {
  const want = needle.trim().toLowerCase();
  const exact = rows.filter((row) => label(row).trim().toLowerCase() === want);
  const pool = exact.length > 0 ? exact : rows.filter((row) => label(row).toLowerCase().includes(want));
  if (pool.length === 0) throw new Error(`I've no ${noun} by the name of ${needle}, ${term}. Nothing has changed.`);
  if (pool.length > 1) {
    // Name the candidates. "Give me the exact wording" is useless when the whole
    // problem is that the user can't tell the two apart from memory.
    const names = pool.slice(0, 4).map((row) => label(row).trim()).filter(Boolean);
    const listed = names.length > 1
      ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`
      : names[0] ?? needle;
    const more = pool.length > names.length ? `, and ${pool.length - names.length} more` : '';
    throw new Error(
      `I have ${pool.length} that match, ${term}: ${listed}${more}. Which one? Nothing has changed.`,
    );
  }
  return pool[0] as T;
}

/**
 * Natural language time, read exactly as the reminder fast path reads it.
 * A vague hour, or a moment already gone, is refused aloud rather than saved wrong.
 */
function whenDate(
  said: string,
  now: Date,
  noun: 'reminder' | 'event',
  term: string,
  rule?: ReturnType<typeof readRepeat>['rule'],
): Date {
  const match = chrono.en.GB.parse(said, now, { forwardDate: true })[0];
  if (!match || !match.start.isCertain('hour')) {
    throw new Error(
      noun === 'reminder'
        ? `What date and time should I remind you, ${term}? Nothing has been saved yet.`
        : `What date and time is that, ${term}? Nothing has gone in the diary.`,
    );
  }
  // A repeating reminder starts on the rule's own footing: "every Monday at 9",
  // said on a Wednesday, must not first fire on the Wednesday.
  const due = rule ? alignToRule(match.start.date(), rule, now) : match.start.date();
  if (due.getTime() <= now.getTime()) {
    throw new Error(`That time has already passed, ${term}. Please give me a future date and time.`);
  }
  return due;
}

/** The repeat the model asked for, either as a field or inside the `when` phrase. */
function repeatOf(action: CavenAction, when: string): { rule: ReturnType<typeof readRepeat>['rule']; when: string } {
  const asked = text(action.repeat).toLowerCase().replace(/[\s_-]+/g, '');
  if (asked === 'daily' || asked === 'everyday') return { rule: { repeat: 'daily' }, when };
  if (asked === 'weekdays' || asked === 'weekday') return { rule: { repeat: 'weekdays' }, when };
  if (asked === 'weekly' || asked === 'everyweek') return { rule: { repeat: 'weekly' }, when };
  const read = readRepeat(when);
  return { rule: read.rule, when: read.rest };
}

/**
 * Carry out one structured action against the board.
 * Throws, in a sentence fit to be spoken, when the action cannot be done honestly.
 * An unknown verb is not an error — it simply changes nothing and says nothing.
 */
export function runAction(action: CavenAction, prev: CavenData, now = new Date()): ActionResult {
  const verb = text(action?.do).toLowerCase().replace(/[\s_:/]+/g, '.');
  const term = addressOf(prev);
  const id = crypto.randomUUID();
  const day = now.toLocaleDateString('en-AU');
  // Rows carry both: `day` is what the board prints, `at` is what anything
  // comparing days or months has to read.
  const at = now.toISOString();
  const idle = (message = ''): ActionResult => ({ data: prev, message, changed: false });

  switch (verb) {
    // Puts back whatever the last delete removed. Deletions are instant, so this
    // is the safety net for a mis-heard "delete the dentist reminder".
    case 'undo': {
      const stash = prev.lastDeleted;
      if (!stash) return idle(`There's nothing to undo, ${term}.`);
      const { kind, row } = stash;
      const rows = prev[kind] as unknown[];
      const restored = { ...prev, [kind]: [row, ...rows], lastDeleted: undefined } as CavenData;
      const label =
        (row as { title?: string; name?: string }).title ??
        (row as { title?: string; name?: string }).name ??
        'That';
      return { data: restored, message: `${label} is back, ${term}.`, changed: true };
    }

    case 'task.add': {
      const title = subject(action.title, 'task', term);
      const task: Task = { id, title, done: false };
      const tag = text(action.tag);
      if (tag) task.tag = tag;
      const time = text(action.time);
      if (time) task.time = time;
      return { data: { ...prev, tasks: [task, ...prev.tasks] }, message: `On the list, ${term}.`, changed: true };
    }

    case 'task.done':
    case 'task.undone': {
      const wanted = verb === 'task.done';
      const title = required(action.title, `Which task did you mean, ${term}? Nothing has changed.`);
      const target = findOne(prev.tasks, (t) => t.title, title, 'task', term);
      if (target.done === wanted) {
        return idle(wanted ? `${target.title} was already crossed off, ${term}.` : `${target.title} is still open, ${term}.`);
      }
      const tasks = prev.tasks.map((t) => (t.id === target.id ? { ...t, done: wanted } : t));
      return { data: { ...prev, tasks }, message: wanted ? 'Crossed off.' : 'Back on the list.', changed: true };
    }

    case 'task.delete': {
      const title = required(action.title, `Which task should go, ${term}? Nothing has changed.`);
      const target = findOne(prev.tasks, (t) => t.title, title, 'task', term);
      return {
        data: { ...prev, tasks: prev.tasks.filter((t) => t.id !== target.id), lastDeleted: { kind: 'tasks', row: target } },
        message: `${target.title} is off the list. Say undo if that was wrong.`,
        changed: true,
      };
    }

    case 'reminder.add': {
      const title = subject(action.title, 'reminder', term);
      const asked = required(action.when, `What date and time should I remind you, ${term}? Nothing has been saved yet.`);
      const { rule, when } = repeatOf(action, asked);
      const due = whenDate(when, now, 'reminder', term, rule);
      return {
        data: { ...prev, reminders: [makeReminder(id, title, due, rule?.repeat), ...prev.reminders] },
        message: reminderLine(due, now, rule?.repeat),
        changed: true,
      };
    }

    case 'reminder.delete': {
      const title = required(action.title, `Which reminder should go, ${term}? Nothing has changed.`);
      const target = findOne(prev.reminders, (r) => r.title, title, 'reminder', term);
      return {
        data: { ...prev, reminders: prev.reminders.filter((r) => r.id !== target.id), lastDeleted: { kind: 'reminders', row: target } },
        message: `${target.title} is off the board. Say undo if that was wrong.`,
        changed: true,
      };
    }

    case 'event.add': {
      const title = subject(action.title, 'entry', term);
      const when = required(action.when, `What date and time is that, ${term}? Nothing has gone in the diary.`);
      const moment = whenDate(when, now, 'event', term);
      const asked = text(action.kind).toLowerCase();
      const kind: CalendarEvent['kind'] = asked === 'routine' || asked === 'reminder' ? asked : 'event';
      // The whole moment is stored. Keeping only the clock time was why a booking
      // for tomorrow appeared under Today, and why CAVEN could agree it was
      // tomorrow while the board beside him said otherwise.
      const event: CalendarEvent = { id, title, time: clockLabel(moment), kind, at: moment.toISOString() };
      return {
        data: { ...prev, calendar: [event, ...prev.calendar] },
        message: `In the diary for ${momentLabel(moment, now)}.`,
        changed: true,
      };
    }

    case 'event.delete': {
      const title = required(action.title, `Which entry should go, ${term}? Nothing has changed.`);
      const target = findOne(prev.calendar, (e) => e.title, title, 'diary entry', term);
      return {
        data: { ...prev, calendar: prev.calendar.filter((e) => e.id !== target.id), lastDeleted: { kind: 'calendar', row: target } },
        message: `${target.title} is out of the diary. Say undo if that was wrong.`,
        changed: true,
      };
    }

    case 'habit.add': {
      const name = required(action.name, `Which habit should I track, ${term}? Nothing has been added.`);
      if (prev.habits.some((h) => sameText(h.name, name))) return idle(`I'm tracking ${name} already, ${term}.`);
      const goal = amountOf(action.goal);
      const habit: Habit = {
        id,
        name,
        streak: 0,
        goal: goal !== null && goal > 0 ? Math.round(goal) : 7,
        done: false,
        icon: text(action.icon) || '◆',
      };
      return {
        data: { ...prev, habits: [habit, ...prev.habits] },
        message: `I'm tracking ${name} from now. Nothing logged against it yet.`,
        changed: true,
      };
    }

    case 'habit.done': {
      const name = required(action.name, `Which habit, ${term}? Nothing has changed.`);
      const target = findOne(prev.habits, (h) => h.name, name, 'habit', term);
      // The tick used to be a bare boolean that nothing ever reset, so a habit
      // done on Monday was still "already ticked today" on Tuesday and the
      // streak counted ticks rather than days. The date is the record now.
      if (habitDoneOn(target, now)) return idle(`${target.name} is already ticked today, ${term}.`);
      const last = parseStamp(target.lastDone);
      // Yesterday continues the run; any longer a gap starts a new one.
      const streak = last && daysBetween(last, now) === 1 ? target.streak + 1 : 1;
      const habits = prev.habits.map((h) =>
        h.id === target.id ? { ...h, done: true, lastDone: dayKey(now), streak } : h,
      );
      const run = streak === 1 ? "That's day one." : `That's ${streak} days in a row.`;
      return { data: { ...prev, habits }, message: `${target.name} ticked. ${run}`, changed: true };
    }

    case 'habit.delete': {
      const name = required(action.name, `Which habit should go, ${term}? Nothing has changed.`);
      const target = findOne(prev.habits, (h) => h.name, name, 'habit', term);
      return {
        data: { ...prev, habits: prev.habits.filter((h) => h.id !== target.id), lastDeleted: { kind: 'habits', row: target } },
        message: `I'll stop tracking ${target.name}. Say undo if that was wrong.`,
        changed: true,
      };
    }

    case 'journal.add': {
      const body = required(action.body, `What should I write, ${term}? Nothing has gone in the journal.`);
      const entry = { id, date: day, at, mood: text(action.mood), title: text(action.title) || 'Journal entry', body };
      return {
        data: { ...prev, journal: [entry, ...prev.journal] },
        message: 'Written up in the journal.',
        changed: true,
      };
    }

    case 'note.add': {
      const body = required(action.text, `What should the note say, ${term}? Nothing has been kept.`);
      return {
        data: { ...prev, voiceNotes: [{ id, text: body, when: day, at }, ...prev.voiceNotes] },
        message: 'I have that down.',
        changed: true,
      };
    }

    case 'note.delete': {
      const body = required(action.text, `Which note should go, ${term}? Nothing has changed.`);
      const target = findOne(prev.voiceNotes, (n) => n.text, body, 'note', term);
      return {
        data: { ...prev, voiceNotes: prev.voiceNotes.filter((n) => n.id !== target.id), lastDeleted: { kind: 'voiceNotes', row: target } },
        message: 'That note is gone. Say undo if that was wrong.',
        changed: true,
      };
    }

    case 'spend.add': {
      const label = required(action.label, `What was it for, ${term}? Nothing has been logged.`);
      const raw = amountOf(action.amount);
      if (raw === null || raw === 0) throw new Error(`How much was it, ${term}? Nothing has been logged.`);
      // Money out is stored negative; the finance page sums transactions for the balance.
      const spent = Math.abs(raw);
      const category = text(action.category) || 'General';
      // `at` is what the month balance filters on; `when` is what the page prints.
      const tx: Transaction = { id, label, amount: -spent, category, when: day, at };
      const budget = prev.budgets.find((b) => sameText(b.category, category));
      const budgets = budget
        ? prev.budgets.map((b) => (b.id === budget.id ? { ...b, spent: b.spent + spent } : b))
        : prev.budgets;
      const running = budget
        ? ` That's ${money(budget.spent + spent)} of ${money(budget.limit)} on ${budget.category}.`
        : '';
      return {
        data: { ...prev, transactions: [tx, ...prev.transactions], budgets },
        message: `Logged. ${label}, ${money(spent)}.${running}`,
        changed: true,
      };
    }

    case 'budget.set': {
      const category = required(action.category, `Which budget, ${term}? Nothing has changed.`);
      const limit = amountOf(action.limit);
      if (limit === null || limit <= 0) throw new Error(`What should the limit be, ${term}? Nothing has changed.`);
      const existing = prev.budgets.find((b) => sameText(b.category, category));
      if (existing) {
        if (existing.limit === limit) return idle(`${existing.category} is already set at ${money(limit)}, ${term}.`);
        const budgets = prev.budgets.map((b) => (b.id === existing.id ? { ...b, limit } : b));
        return {
          data: { ...prev, budgets },
          message: `${existing.category} now runs to ${money(limit)}, with ${money(existing.spent)} spent against it.`,
          changed: true,
        };
      }
      const budget: Budget = { id, category, spent: 0, limit };
      return {
        data: { ...prev, budgets: [...prev.budgets, budget] },
        message: `${category} is set at ${money(limit)}. Nothing spent against it yet.`,
        changed: true,
      };
    }

    case 'brain.note': {
      const note = required(action.text, `What should I remember, ${term}? Nothing has been filed.`);
      if (prev.brainNotes.some((n) => sameText(n, note))) return idle(`I have that one already, ${term}.`);
      return { data: { ...prev, brainNotes: [note, ...prev.brainNotes] }, message: 'Filed away.', changed: true };
    }

    case 'interest.add': {
      const name = required(action.name, `Which interest, ${term}? Nothing has changed.`);
      if (prev.interests.some((i) => sameText(i, name))) return idle(`${name} is already down as an interest, ${term}.`);
      return { data: { ...prev, interests: [name, ...prev.interests] }, message: `${name}, noted.`, changed: true };
    }

    case 'address.set': {
      // Shape, length and decency all live in checkAddress, so the Settings
      // field and this verb can never disagree about what is acceptable.
      const verdict = checkAddress(action.term, term);
      if (!verdict.ok) throw new Error(verdict.reason);
      if (verdict.term === term) return idle(`I call you ${term} already.`);
      // The new term does the confirming, so he hears at once what he will be called.
      return { data: { ...prev, address: verdict.term }, message: `Very good, ${verdict.term}. I shall address you so from now on.`, changed: true };
    }

    // A verb we do not serve. Say nothing and change nothing rather than invent a result.
    default:
      return idle();
  }
}

/** Index just past a balanced JSON object or array, honouring strings. -1 if unterminated. */
function scanJson(source: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return i + 1;
      if (depth < 0) return -1;
    }
  }
  return -1;
}

/** Keep whatever is a usable action; a malformed block is dropped without a word. */
function collect(json: string, into: CavenAction[]): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return;
  }
  for (const row of Array.isArray(parsed) ? parsed : [parsed]) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const verb = (row as Record<string, unknown>).do;
    if (typeof verb !== 'string' || !verb.trim()) continue;
    into.push({ ...(row as Record<string, unknown>), do: verb.trim() });
  }
}

/** Close the gap left where an action block was lifted out of a sentence. */
function tidy(spoken: string): string {
  return spoken
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const ACT_OPEN = /\[\[\s*ACT\b/i;

/**
 * Split a model reply into the words CAVEN speaks and the actions he is to carry out.
 * Tolerates several blocks, a block mid-sentence, a block that never closes, and JSON
 * that will not parse — a broken action is discarded, never spoken and never thrown.
 */
export function parseActions(reply: string): { spoken: string; actions: CavenAction[] } {
  const source = typeof reply === 'string' ? reply : '';
  const actions: CavenAction[] = [];
  let spoken = '';
  let rest = source;

  for (;;) {
    const open = ACT_OPEN.exec(rest);
    if (!open) {
      spoken += rest;
      break;
    }
    spoken += rest.slice(0, open.index);
    const block = rest.slice(open.index);
    let cursor = open[0].length;
    while (cursor < block.length && /\s/.test(block[cursor] as string)) cursor++;

    let end = cursor;
    const head = block[cursor];
    if (head === '{' || head === '[') {
      const close = scanJson(block, cursor);
      if (close < 0) break; // Unterminated block: drop the tail, keep what was said.
      collect(block.slice(cursor, close), actions);
      end = close;
    }

    let tail = end;
    while (tail < block.length && /\s/.test(block[tail] as string)) tail++;
    if (block.startsWith(']]', tail)) {
      tail += 2;
    } else {
      const bracket = block.indexOf(']]', end);
      tail = bracket < 0 ? block.length : bracket + 2;
    }
    rest = block.slice(tail);
  }

  return { spoken: tidy(spoken), actions };
}
