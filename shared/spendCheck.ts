// "Can I spend this?" answered from the budgets he actually saved.
//
// This is the question where inventing a number does real damage, so there is
// exactly one source for every figure spoken: a `budgets` row on the board. No
// bank, no payment, no checkout, and no estimate. If there is no row to answer
// from, the honest answer is that there is no row.
//
// Returns null when the question wasn't asked, or when no amount could be made
// out — the caller then takes its ordinary path rather than guessing.

import { numberIn } from './numbers.ts';
import type { CavenData } from '../src/lib/store';

type Budget = CavenData['budgets'][number];

/** Asking whether there is room for a spend, as opposed to recording one. */
const ASKS_TO_SPEND =
  /\b(?:can i (?:spend|afford|justify)|could i (?:spend|afford)|am i (?:ok|okay|alright|right) to spend|have i got room for|is there room for|do i have room for|can i drop)\b/i;

/** The amount in the utterance, in whichever form he said it. */
export { numberIn as amountIn } from './numbers.ts';

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
  const amount = numberIn(said);
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
