// "Can I spend this?" answered from the budgets he actually saved.
//
// This is the question where inventing a number does real damage, so there is
// exactly one source for every figure spoken: a `budgets` row on the board. No
// bank, no payment, no checkout, and no estimate. If there is no row to answer
// from, the honest answer is that there is no row.
//
// Returns null when the question wasn't asked, or when no amount could be made
// out — the caller then takes its ordinary path rather than guessing.

import type { CavenData } from '../src/lib/store';

type Budget = CavenData['budgets'][number];

/** Asking whether there is room for a spend, as opposed to recording one. */
const ASKS_TO_SPEND =
  /\b(?:can i (?:spend|afford|justify)|could i (?:spend|afford)|am i (?:ok|okay|alright|right) to spend|have i got room for|is there room for|do i have room for|can i drop)\b/i;

/** Written as digits: "$80", "80.50", "1,200". */
const DIGITS = /\$?\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\b/;

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/**
 * An amount spoken as words: "eighty", "a hundred and fifty", "two thousand".
 *
 * Speech recognition gives back whichever of the two forms he happened to say,
 * so both have to be read or the feature only works when he talks like a
 * keyboard. Scanning stops at the first run of number words, so "spend eighty on
 * dinner for two" is eighty, not eighty-two.
 */
function spokenNumber(said: string): number | null {
  let total = 0;
  let group = 0;
  let seen = false;

  for (const word of said.toLowerCase().split(/[^a-z]+/)) {
    if (!word) continue;
    if (word in UNITS) {
      group += UNITS[word]!;
      seen = true;
    } else if (word in TENS) {
      group += TENS[word]!;
      seen = true;
      // "a hundred" carries no digit word of its own, so these have to be able
      // to open a group rather than only multiply one.
    } else if (word === 'hundred') {
      group = (group || 1) * 100;
      seen = true;
    } else if (word === 'thousand') {
      total += (group || 1) * 1000;
      group = 0;
      seen = true;
    } else if (seen && (word === 'and' || word === 'dollars' || word === 'dollar' || word === 'bucks')) {
      continue;
    } else if (seen) {
      break;
    }
  }

  return seen ? total + group : null;
}

/** The amount in the utterance, or null when there isn't one to be had. */
export function amountIn(said: string): number | null {
  const digits = DIGITS.exec(said);
  if (digits) {
    const whole = Number(digits[1]!.replace(/,/g, ''));
    const cents = digits[2] ? Number(`0.${digits[2]}`) : 0;
    if (Number.isFinite(whole)) return whole + cents;
  }
  return spokenNumber(said);
}

/** Whole dollars stay whole; cents are only spoken when there are any. */
function money(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return `$${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}

function budgetsOf(data: Partial<CavenData> | null | undefined): Budget[] {
  return (Array.isArray(data?.budgets) ? data.budgets : []).filter(
    (row): row is Budget => !!row && typeof row.category === 'string' && !!row.category.trim(),
  );
}

/**
 * Which budget he meant.
 *
 * Only a category he actually named, matched against the rows on the board — no
 * synonym table, because deciding on his behalf that "lunch" means "dining" is
 * how a wrong number gets spoken with confidence. Failing that, a single saved
 * budget is unambiguous; several are not.
 */
function pickBudget(said: string, rows: Budget[]): Budget | null {
  const lower = said.toLowerCase();
  const named = rows.filter((row) => lower.includes(row.category.trim().toLowerCase()));
  if (named.length === 1) return named[0]!;
  if (named.length > 1) return null;
  return rows.length === 1 ? rows[0]! : null;
}

/**
 * The answer, or null when this isn't that question.
 *
 * Every figure here is `limit - spent` off a real row. "I don't have a budget
 * saved for that" is a perfectly good answer and far better than a guess.
 */
export function spendCheck(
  data: Partial<CavenData> | null | undefined,
  said: string,
  ): string | null {
  if (!ASKS_TO_SPEND.test(said)) return null;
  const amount = amountIn(said);
  if (amount === null) return null;

  const rows = budgetsOf(data);
  if (!rows.length) return "I don't have a budget saved for that.";

  const budget = pickBudget(said, rows);
  if (!budget) return "I've a few budgets saved. Which one did you mean?";

  const limit = Number(budget.limit);
  const spent = Number(budget.spent);
  if (!Number.isFinite(limit) || !Number.isFinite(spent)) {
    return `I don't have the numbers for ${budget.category}, I'm afraid.`;
  }

  const left = limit - spent;
  const category = budget.category.trim();

  if (left <= 0) {
    return `You're already ${money(Math.abs(left))} over on ${category}, so no.`;
  }
  if (amount > left) {
    return `That would put you ${money(amount - left)} over on ${category}. There's ${money(left)} left on it.`;
  }
  return `You've ${money(left)} left on ${category}, so yes — ${money(left - amount)} after.`;
}
