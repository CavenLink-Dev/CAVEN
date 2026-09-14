// Reading a number out of something spoken.
//
// Speech recognition returns whichever form he happened to say — "$80", "80",
// "eighty", "a hundred and fifty" — so anything that wants a number out of an
// utterance has to read all of them, or the feature quietly only works when he
// talks like a keyboard. One copy, used by money and by durations.

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

/** Words that sit inside a spoken number without being part of the count. */
const CARRIED = new Set(['and', 'dollars', 'dollar', 'bucks', 'cents']);

/**
 * A number spelled out: "eighty", "a hundred and fifty", "two thousand".
 *
 * Scanning stops at the first word that isn't part of the run, so "spend eighty
 * on dinner for two" is eighty rather than eighty-two.
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
      // "a hundred" carries no digit word of its own, so these have to be able to
      // open a group rather than only multiply one.
    } else if (word === 'hundred') {
      group = (group || 1) * 100;
      seen = true;
    } else if (word === 'thousand') {
      total += (group || 1) * 1000;
      group = 0;
      seen = true;
    } else if (seen && CARRIED.has(word)) {
      continue;
    } else if (seen) {
      break;
    }
  }

  return seen ? total + group : null;
}

/** The first number in the utterance, in whichever form it was said. */
export function numberIn(said: string): number | null {
  const digits = DIGITS.exec(said);
  if (digits) {
    const whole = Number(digits[1]!.replace(/,/g, ''));
    const cents = digits[2] ? Number(`0.${digits[2]}`) : 0;
    if (Number.isFinite(whole)) return whole + cents;
  }
  return spokenNumber(said);
}
