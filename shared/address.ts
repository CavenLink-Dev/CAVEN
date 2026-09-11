// How CAVEN addresses the user — "sir", "madam", "Master", or whatever he
// chooses. Nothing anywhere should hardcode a term: read it from the board
// through addressOf(), and fall back to DEFAULT_ADDRESS only when unset.
//
// Plain .ts on purpose. The store lives in a .tsx React module that imports
// shared/actions.ts, so putting this here keeps both sides free of a cycle
// and lets the node test runner load it.

export const DEFAULT_ADDRESS = 'sir';
export const ADDRESS_LIMIT = 24;

export function addressOf(data: { address?: unknown } | null | undefined): string {
  const chosen = typeof data?.address === 'string' ? data.address.trim() : '';
  return chosen || DEFAULT_ADDRESS;
}

// Fold the obvious evasions together — case, accents, leetspeak, padding and
// punctuation — so "M@ster" and "s l u t" reduce to the same plain letters the
// blocklist is written in.
function fold(term: string): string {
  return term
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[0o]/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e')
    .replace(/[4@]/g, 'a').replace(/[5$]/g, 's').replace(/7/g, 't')
    .replace(/[^a-z]/g, '');
}

// Roots, not whole words, so padding and plurals are caught too. Kept short and
// maintainable rather than exhaustive: this is a courtesy title, and anything
// questionable enough to need a longer list is already refused by the shape
// rules below.
const BLOCKED = [
  'fuck', 'shit', 'cunt', 'bitch', 'bastard', 'wanker', 'prick', 'twat',
  'dick', 'cock', 'penis', 'vagina', 'pussy', 'tits', 'boob', 'anal', 'anus',
  'slut', 'whore', 'hoe', 'porn', 'rape', 'sex', 'horny', 'daddy', 'milf',
  'nigg', 'fagg', 'retard', 'spastic', 'chink', 'kike', 'spic', 'wetback',
  'tranny', 'nazi', 'hitler', 'kill', 'suicide',
];

export type AddressCheck = { ok: true; term: string } | { ok: false; reason: string };

/**
 * Validate a proposed term of address. `reason` is spoken aloud, so it carries
 * no markup and names what is wrong without repeating what he said back to him.
 */
export function checkAddress(raw: unknown, spokenTo: string): AddressCheck {
  const source = typeof raw === 'string' ? raw : '';
  // Checked BEFORE whitespace is collapsed. A newline in a courtesy title only
  // ever means someone probing the briefing, so refuse it rather than quietly
  // flattening it into a space.
  if (/[\r\n\t\u0000-\u001f\u007f]/.test(source)) {
    return { ok: false, reason: `That is not a name I can use, ${spokenTo}. Nothing has changed.` };
  }
  const term = source.trim().replace(/\s+/g, ' ');

  if (!term) return { ok: false, reason: `What should I call you, ${spokenTo}? Nothing has changed.` };
  if (term.length > ADDRESS_LIMIT) {
    return { ok: false, reason: `Keep it to twenty-four characters or fewer, ${spokenTo}. Nothing has changed.` };
  }
  // Letters, spaces, hyphens and apostrophes cover every real honorific and
  // keep markup, control characters and the ACT syntax out of the prompt.
  if (!/^[\p{L}][\p{L} .'’-]*$/u.test(term)) {
    return { ok: false, reason: `Letters only for that, ${spokenTo}. Nothing has changed.` };
  }
  const folded = fold(term);
  if (!folded) return { ok: false, reason: `That is not a name I can use, ${spokenTo}. Nothing has changed.` };
  if (BLOCKED.some((bad) => folded.includes(bad))) {
    return { ok: false, reason: `I would rather not, ${spokenTo}. Choose something I can say in company.` };
  }
  return { ok: true, term };
}
