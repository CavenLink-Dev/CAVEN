import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cssPath = path.join(root, 'src/index.css');

/** Drop comments so a footnote cannot hide a real rule. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * CSS cascade: anything left outside @layer always beats layered Tailwind
 * utilities, regardless of specificity. This keeps only that unlayered sheet.
 */
function unlayered(css: string): string {
  const src = stripComments(css);
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('@layer', i) && !/[\w-]/.test(src[i + 6] ?? '')) {
      let j = i + 6;
      while (j < src.length && src[j] !== '{' && src[j] !== ';') j++;
      if (src[j] === ';') {
        i = j + 1;
        continue;
      }
      if (src[j] === '{') {
        let depth = 0;
        for (; j < src.length; j++) {
          if (src[j] === '{') depth++;
          else if (src[j] === '}') {
            depth--;
            if (depth === 0) {
              j++;
              break;
            }
          }
        }
        i = j;
        continue;
      }
    }
    out += src[i++];
  }
  return out;
}

function classBodies(css: string, className: string): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(css))) {
    if (new RegExp(`\\.${className}(?![\\w-])`).test(match[1])) bodies.push(match[2]);
  }
  return bodies;
}

function unlayeredFontDisplaySetsTracking(css: string): boolean {
  return classBodies(unlayered(css), 'font-display').some((body) => /letter-spacing/.test(body));
}

test('the detector flags the production one-liner that stomps tracking utilities', () => {
  const shipped =
    '.font-display { font-family: var(--font-display); letter-spacing: var(--track-label); }';
  assert.equal(unlayeredFontDisplaySetsTracking(shipped), true);
  assert.equal(
    unlayeredFontDisplaySetsTracking(`@layer components { ${shipped} }`),
    false,
  );
});

test('unlayered .font-display must not set letter-spacing', () => {
  const css = readFileSync(cssPath, 'utf8');
  assert.equal(
    unlayeredFontDisplaySetsTracking(css),
    false,
    'Unlayered letter-spacing on .font-display beats every tracking-* utility (0.16em).',
  );
});
