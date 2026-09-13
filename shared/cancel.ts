// Calling a turn off.
//
// "Stop", "never mind", "leave it" must cost nothing: no write, no question to
// the model, no card. They are also the shortest possible utterances, which is
// exactly why the match has to be the *whole* of what was said.
//
// "Never mind" calls the turn off. "Never mind the dentist reminder" is a
// deletion, and belongs to the model path in shared/actions.ts, which owns the
// delete verbs and asks which record was meant rather than guessing. One stray
// word between those two readings is the difference between doing nothing and
// removing the wrong row, so nothing here matches on a substring.

import { tidySpeech } from './endpoint.ts';

/** Said on its own, each of these means "drop it". Said with an object, none of them do. */
const CANCEL =
  /^(?:stop|stop it|stop that|stop there|cancel|cancel that|never ?mind|forget it|forget that|leave it|leave that|drop it|scrap that|ignore that|don't bother|do not bother|abort|as you were)$/;

/** Courtesies that trail a command without changing it. */
const TRAILING_COURTESY = /\s+(?:please|thanks|thank you|ta)$/;

/**
 * True when the whole utterance is him calling it off.
 *
 * `address` is his chosen term — "stop, sir", "never mind, Master" — read from
 * the board rather than hardcoded, so a man who asked to be called Your Lordship
 * can still cancel in one breath.
 */
export function isCancel(said: string, address?: string): boolean {
  let tidied = tidySpeech(said);
  if (!tidied) return false;

  const term = tidySpeech(address ?? '');
  if (term) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    tidied = tidied.replace(new RegExp(`(?:^${escaped}\\s+|\\s+${escaped}$)`), '').trim();
  }
  tidied = tidied.replace(TRAILING_COURTESY, '').trim();

  return CANCEL.test(tidied);
}
