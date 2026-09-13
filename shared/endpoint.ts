// When the mic may close.
//
// Real speech is full of held-open moments — "I need to, um—" — and the one
// mistake that cannot be recovered from is cutting a man off mid-thought and
// saving the fragment as a command. Waiting a beat too long costs a beat; ending
// early costs the whole sentence and writes rubbish to the board.
//
// This file answers one question and nothing else: given the partial transcript
// so far, how long may the recogniser stay quiet before we call it finished? It
// deliberately knows nothing about dates, intents or the board — src/lib/voice.ts
// owns the timers, shared/actions.ts owns what the words mean. Pure and free of
// imports so the node test runner can hold it to account.
//
// No relative imports here on purpose: nothing to carry a .js suffix, and no
// browser API, so it loads unchanged in the tab and in `pnpm test`.

/** He is still talking. Long enough for a breath, short of an awkward wait. */
const PATIENT_MS = 2200;
/** A routine step answer ("done", "skip") — little for the recogniser to chew on. */
const SHORT_ANSWER_MS = 900;
/** A sentence that reads as finished. */
const SETTLED_MS = 800;

export type EndpointOpts = {
  /** Set when a one-word answer is expected, as during a routine step. */
  expectShort?: boolean;
};

/**
 * Speech as plain lowercase words.
 *
 * Dashes become spaces rather than vanishing, so "um—" still ends on "um", and
 * curly apostrophes are folded to straight ones so one spelling of "that's"
 * matches everywhere.
 */
function tidy(said: string): string {
  return said
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014-]+/g, ' ')
    .replace(/[.,!?;:…"'`]+(?=\s|$)/g, ' ')
    .replace(/[.,!?;:…]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lastWord(tidied: string): string {
  const words = tidied.split(' ');
  return words[words.length - 1] ?? '';
}

/** Sounds that mean "still thinking", never a command in their own right. */
const FILLERS = new Set([
  'um', 'umm', 'ummm', 'uh', 'uhh', 'ah', 'ahh', 'er', 'err', 'erm', 'hmm', 'hm',
  'mmm', 'like', 'so', 'well', 'wait',
]);

/** The same thing said as a phrase. */
const FILLER_PHRASE = /(?:hold on|hang on|actually|i mean|you know|sort of|kind of)$/;

/** Words a sentence cannot honestly end on. */
const DANGLING = new Set([
  'to', 'at', 'for', 'and', 'or', 'but', 'the', 'a', 'an', 'my', 'your', 'of',
  'with', 'about', 'from', 'into', 'that', 'than', 'is', 'was', 'are', 'were',
  'because', 'if', 'when', 'while', 'before', 'after', 'until',
]);

/**
 * An opening with nothing after it yet. Matched against the whole utterance —
 * "Add" is a man drawing breath, "Add milk to the list" is an instruction.
 */
const OPENER_ONLY =
  /^(?:caven )?(?:remind me(?: to)?|i need to|i want to|i have to|i've got to|can you|could you|would you|will you|add|call|text|put|book|set|make|take|tell|send|show me|tomorrow at|today at|tonight at|wait no|no wait|actually no|the thing with|i'll|let's)$/;

/** Said at the end of a thought to hand the turn over deliberately. */
const CLOSER_TAIL = /(?:that'?s (?:it|all)|that is (?:it|all)|go ahead|send it)$/;
/** Closers that only count as the whole utterance — "done" is also a routine answer. */
const WHOLE_CLOSER = /^(?:done|that'?s it|that is it|that'?s all|that is all|go ahead|send it)$/;

/** True when the last thing heard was a filler — he has not finished. */
export function hasFillerTail(said: string): boolean {
  const tidied = tidy(said);
  if (!tidied) return false;
  if (FILLER_PHRASE.test(tidied)) return true;
  return FILLERS.has(lastWord(tidied));
}

/**
 * True when the clause cannot stand on its own yet.
 *
 * Nothing heard at all counts as unfinished: an empty transcript is silence, not
 * a finished sentence, and the caller's own lead-in decides how long to give it.
 */
export function isIncomplete(said: string): boolean {
  const tidied = tidy(said);
  if (!tidied) return true;
  if (OPENER_ONLY.test(tidied)) return true;
  return DANGLING.has(lastWord(tidied));
}

/** True when he has handed the turn over in so many words. */
export function isExplicitEnd(said: string): boolean {
  const tidied = tidy(said);
  if (!tidied) return false;
  return WHOLE_CLOSER.test(tidied) || CLOSER_TAIL.test(tidied);
}

/**
 * How long the recogniser may stay quiet before the turn is treated as over.
 *
 * Zero means close it now — he said so. Everything else is a patience budget,
 * and the order matters: a filler outranks an expected short answer, because
 * hesitating is exactly when a fixed timeout used to cut him off.
 */
export function silenceMs(said: string, opts: EndpointOpts = {}): number {
  if (isExplicitEnd(said)) return 0;
  if (hasFillerTail(said) || isIncomplete(said)) return PATIENT_MS;
  if (opts.expectShort) return SHORT_ANSWER_MS;
  return SETTLED_MS;
}
