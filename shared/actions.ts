// CAVEN's execution engine. Two doors in:
//   applyCommand — the regex fast path called by route() in src/lib/cavenState.ts.
//   runAction    — one structured action the chat model emitted as [[ACT {...}]].
// Both are pure: `prev` is never mutated, and changed:false means nothing was written.
// Every `message` is spoken aloud by TTS, so no markdown, no bullets, no emoji, and
// never a claim larger than what actually happened.
import * as chrono from 'chrono-node';
import type {CavenData} from '../src/lib/store';
export type ActionKind='reminder'|'tasks'|'journal'|'voicenote'|'calendar'|'habits'|'finance'|'brain';
export type CavenAction={do:string;[key:string]:unknown};
export type ActionResult={data:CavenData;message:string;changed:boolean};
// Address rules live in shared/address.ts so the Settings field, the voice
// verb and every spoken line agree on one definition of an acceptable term.
import { addressOf, checkAddress } from './address.ts';
// Re-exported so callers keep one import for the action engine's whole surface.
export { addressOf, checkAddress, DEFAULT_ADDRESS, ADDRESS_LIMIT } from './address.ts';
export function applyCommand(kind:ActionKind,text:string,prev:CavenData,now=new Date()):ActionResult {
 const said=text.trim(), term=addressOf(prev), id=crypto.randomUUID(), day=now.toLocaleDateString('en-AU'), unchanged={data:prev,message:'Here it is.',changed:false};
 // Queries and negations never mutate data. Viewing and writing are separate operations.
 if(/^(show|what|how|when|where|do i|did i|have i|can you show|tell me|open|check|don'?t (add|save|create|log|delete)|do not)\b/i.test(said)) return unchanged;
 if(kind==='reminder' && /\b(remind me|set a reminder|reminder for|nudge me|wake me|let me forget)\b/i.test(said)) {
  const match=chrono.en.GB.parse(said,now,{forwardDate:true})[0];
  if(!match||!match.start.isCertain('hour'))throw new Error(`What date and time should I remind you, ${term}? Nothing has been saved yet.`);
  const due=match.start.date();
  if(due.getTime()<=now.getTime())throw new Error(`That time has already passed, ${term}. Please give me a future date and time.`);
  const title=(said.slice(0,match.index)+said.slice(match.index+match.text.length)).replace(/^(?:caven[, ]*)?(?:remind me(?: to)?|set a reminder(?: for)?|nudge me(?: to)?|wake me|don'?t let me forget(?: to)?)\s*/i,'').replace(/\b(at|on|for)\s*$/i,'').trim()||'Reminder';
  return {data:{...prev,reminders:[{id,title,date:due.toLocaleDateString('en-AU'),time:due.toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'}),dueAt:due.toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},...prev.reminders]},message:`It's on the board for ${due.toLocaleString('en-AU')}.`,changed:true};
 }
 if(kind==='tasks') {
  const done=said.match(/^(?:please )?(?:tick|cross) (.+?) off(?: my (?:list|tasks))?$/i)||said.match(/^(?:complete|finish|mark complete) (.+)$/i);
  if(done){const target=prev.tasks.filter(t=>t.title.toLowerCase()===done[1].toLowerCase());if(target.length!==1)throw new Error(`Please use the exact task name, ${term}. Nothing changed.`);return{data:{...prev,tasks:prev.tasks.map(t=>t.id===target[0].id?{...t,done:true}:t)},message:"That's done.",changed:true};}
  const add=said.match(/^(?:please )?(?:add (?:a |an )?task[: ]*|new task[: ]*|add )(.+?)(?: to my (?:tasks|list))?$/i);
  if(add)return{data:{...prev,tasks:[{id,title:add[1],done:false},...prev.tasks]},message:"Noted. It's on the list.",changed:true};
 }
 if(kind==='journal'&&/^(?:journal[: ]|(?:add|write|save|log)\b)/i.test(said))return{data:{...prev,journal:[{id,date:day,mood:'',title:'Journal entry',body:said.replace(/^journal[: ]*/i,'')},...prev.journal]},message:"It's in the journal.",changed:true};
 if(kind==='voicenote'&&/^(?:make|take|save|add|note|jot|remember)\b/i.test(said))return{data:{...prev,voiceNotes:[{id,text:said,when:day},...prev.voiceNotes]},message:"I've got that down.",changed:true};
 if(kind==='calendar'&&/^(book|schedule|add)\b/i.test(said))throw new Error(`Calendar booking is not connected yet, ${term}. I can save a reminder with a date and time.`);
 return unchanged;
}

type Task = CavenData['tasks'][number];
type Habit = CavenData['habits'][number];
type CalendarEvent = CavenData['calendar'][number];
type Transaction = CavenData['transactions'][number];
type Budget = CavenData['budgets'][number];

/** Every verb runAction understands. The system prompt is kept in step with this list. */
export const ACTION_VERBS: readonly string[] = [
  'task.add',
  'task.done',
  'task.undone',
  'task.delete',
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
    throw new Error(
      `Several ${noun}s match ${needle}, ${term}. Give me the exact wording and I'll see to it. Nothing has changed.`,
    );
  }
  return pool[0] as T;
}

/**
 * Natural language time, read exactly as the reminder fast path reads it.
 * A vague hour, or a moment already gone, is refused aloud rather than saved wrong.
 */
function whenDate(said: string, now: Date, noun: 'reminder' | 'event', term: string): Date {
  const match = chrono.en.GB.parse(said, now, { forwardDate: true })[0];
  if (!match || !match.start.isCertain('hour')) {
    throw new Error(
      noun === 'reminder'
        ? `What date and time should I remind you, ${term}? Nothing has been saved yet.`
        : `What date and time is that, ${term}? Nothing has gone in the diary.`,
    );
  }
  const due = match.start.date();
  if (due.getTime() <= now.getTime()) {
    throw new Error(`That time has already passed, ${term}. Please give me a future date and time.`);
  }
  return due;
}

function clockOf(date: Date): string {
  return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
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
  const idle = (message = ''): ActionResult => ({ data: prev, message, changed: false });

  switch (verb) {
    case 'task.add': {
      const title = required(action.title, `What should the task be, ${term}? Nothing has been added.`);
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
        data: { ...prev, tasks: prev.tasks.filter((t) => t.id !== target.id) },
        message: `${target.title} is off the list.`,
        changed: true,
      };
    }

    case 'reminder.add': {
      const title = required(action.title, `What should I remind you about, ${term}? Nothing has been saved.`);
      const when = required(action.when, `What date and time should I remind you, ${term}? Nothing has been saved yet.`);
      const due = whenDate(when, now, 'reminder', term);
      const reminder = {
        id,
        title,
        date: due.toLocaleDateString('en-AU'),
        time: clockOf(due),
        dueAt: due.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      return {
        data: { ...prev, reminders: [reminder, ...prev.reminders] },
        message: `On the board for ${due.toLocaleString('en-AU')}.`,
        changed: true,
      };
    }

    case 'reminder.delete': {
      const title = required(action.title, `Which reminder should go, ${term}? Nothing has changed.`);
      const target = findOne(prev.reminders, (r) => r.title, title, 'reminder', term);
      return {
        data: { ...prev, reminders: prev.reminders.filter((r) => r.id !== target.id) },
        message: `${target.title} is off the board.`,
        changed: true,
      };
    }

    case 'event.add': {
      const title = required(action.title, `What shall I call it, ${term}? Nothing has gone in the diary.`);
      const when = required(action.when, `What date and time is that, ${term}? Nothing has gone in the diary.`);
      const at = whenDate(when, now, 'event', term);
      const asked = text(action.kind).toLowerCase();
      const kind: CalendarEvent['kind'] = asked === 'routine' || asked === 'reminder' ? asked : 'event';
      const event: CalendarEvent = { id, title, time: clockOf(at), kind };
      return {
        data: { ...prev, calendar: [event, ...prev.calendar] },
        message: `In the diary at ${event.time}.`,
        changed: true,
      };
    }

    case 'event.delete': {
      const title = required(action.title, `Which entry should go, ${term}? Nothing has changed.`);
      const target = findOne(prev.calendar, (e) => e.title, title, 'diary entry', term);
      return {
        data: { ...prev, calendar: prev.calendar.filter((e) => e.id !== target.id) },
        message: `${target.title} is out of the diary.`,
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
      if (target.done) return idle(`${target.name} is already ticked today, ${term}.`);
      const streak = target.streak + 1;
      const habits = prev.habits.map((h) => (h.id === target.id ? { ...h, done: true, streak } : h));
      return { data: { ...prev, habits }, message: `${target.name} ticked. That's ${streak} in a row.`, changed: true };
    }

    case 'habit.delete': {
      const name = required(action.name, `Which habit should go, ${term}? Nothing has changed.`);
      const target = findOne(prev.habits, (h) => h.name, name, 'habit', term);
      return {
        data: { ...prev, habits: prev.habits.filter((h) => h.id !== target.id) },
        message: `I'll stop tracking ${target.name}.`,
        changed: true,
      };
    }

    case 'journal.add': {
      const body = required(action.body, `What should I write, ${term}? Nothing has gone in the journal.`);
      const entry = { id, date: day, mood: text(action.mood), title: text(action.title) || 'Journal entry', body };
      return {
        data: { ...prev, journal: [entry, ...prev.journal] },
        message: 'Written up in the journal.',
        changed: true,
      };
    }

    case 'note.add': {
      const body = required(action.text, `What should the note say, ${term}? Nothing has been kept.`);
      return {
        data: { ...prev, voiceNotes: [{ id, text: body, when: day }, ...prev.voiceNotes] },
        message: 'I have that down.',
        changed: true,
      };
    }

    case 'note.delete': {
      const body = required(action.text, `Which note should go, ${term}? Nothing has changed.`);
      const target = findOne(prev.voiceNotes, (n) => n.text, body, 'note', term);
      return {
        data: { ...prev, voiceNotes: prev.voiceNotes.filter((n) => n.id !== target.id) },
        message: 'That note is gone.',
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
      const tx: Transaction = { id, label, amount: -spent, category, when: day };
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
