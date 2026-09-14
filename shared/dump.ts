// Thinking aloud, and what to do with it.
//
// "I need to call Sam, book the dentist, and remember the invoice" is a man
// emptying his head, not three instructions. Saving all three on the spot is how
// a board fills up with half-meant rows; saying nothing is how they get lost.
// So it is read back and saved only on a yes.
//
// The confirmation step is enforced here rather than asked of the model in the
// prompt. A prompt is a request; this is a rule. AGENTS.md has said "never claim
// something is done unless it is" throughout, and the model still narrated
// deletions it never performed — manners are not a mechanism.

/** Openers that mark an utterance as unloading rather than instructing. */
const DUMP_OPENER =
  /\b(?:i need to|i have to|i've got to|i got to|i must|i should|i ought to|i want to|remind me to|remember to|don'?t let me forget to|things? to do|on my plate|rattling round)\b/i;

/** Strip the opener so the first item doesn't carry it into the title. */
const LEADING = /^(?:.*?\b(?:i need to|i have to|i've got to|i got to|i must|i should|i ought to|i want to|remember to|don'?t let me forget to)\s+)/i;

/** Noise that clings to the front of an item once it has been split off. */
const ITEM_NOISE = /^(?:and|then|also|to|i need to|i have to|i must|i should|please)\s+/i;

const NUMBER_WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** "three things" reads better aloud than "3 things". */
export function countWord(n: number): string {
  return NUMBER_WORD[n] ?? String(n);
}

/**
 * The separate things in a dump.
 *
 * Splitting on "and" is the risky part: "call Sam and Jo" is one errand, not two.
 * A fragment of a single word is therefore folded back into the item before it,
 * which turns that case back into one item — and one item is not a dump at all.
 */
export function extractItems(said: string): string[] {
  const body = said.trim().replace(LEADING, '');
  if (!body) return [];

  // ", and" / ", then" are one separator, not two.
  const normalised = body.replace(/,\s*(?:and|then)\s+/gi, ', ');

  const items: string[] = [];
  for (const raw of normalised.split(/\s*,\s*|\s+and\s+|\s+then\s+/i)) {
    const part = raw.trim().replace(ITEM_NOISE, '').replace(/[.!?;:]+$/, '').trim();
    if (!part) continue;
    if (part.split(/\s+/).length < 2 && items.length) {
      // Not an errand of its own — it belongs to the one before it.
      items[items.length - 1] = `${items[items.length - 1]} and ${part}`;
      continue;
    }
    if (part.split(/\s+/).length < 2) continue;
    items.push(part);
  }

  // The same thing said twice is still one thing.
  return [...new Map(items.map((item) => [item.toLowerCase(), item])).values()];
}

/**
 * The items he was thinking aloud about, or null when this wasn't that.
 *
 * Two is the threshold: a single errand said plainly is an instruction, and
 * making him confirm it would be officious.
 */
export function readDump(said: string): string[] | null {
  if (!DUMP_OPENER.test(said)) return null;
  const items = extractItems(said);
  return items.length >= 2 ? items : null;
}

/** Reading it back. Only ever said when there is something to read back. */
export function confirmLine(items: string[]): string {
  return `That's ${countWord(items.length)} things: ${items.join(', ')}. Shall I save them?`;
}

/** A yes, in the forms people actually say it. */
const AFFIRMATIVE =
  /^(?:yes|yeah|yep|yup|ok|okay|sure|please|please do|go on|go ahead|do it|save (?:them|those|that|it)|that'?s right|correct|right|all of them|the lot)\b/i;

/** A no. Kept apart from isCancel, which is about abandoning the turn entirely. */
const NEGATIVE = /^(?:no|nope|nah|not (?:those|them|that|quite|really)|don'?t|do not|leave (?:them|those|it))\b/i;

export function isAffirmative(said: string): boolean {
  return AFFIRMATIVE.test(said.trim());
}

export function isNegative(said: string): boolean {
  return NEGATIVE.test(said.trim());
}
