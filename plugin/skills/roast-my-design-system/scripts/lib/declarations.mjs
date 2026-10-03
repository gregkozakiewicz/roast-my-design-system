/**
 * The styling declarations beyond colour and spacing that both checkers judge:
 * radius, font size, shadow and typeface.
 *
 * They live here rather than in either checker because keeping two copies is
 * exactly how the engine and guard-my-design-system drifted apart in the first
 * place. One set of patterns, one idea of what counts as a value, two scopes:
 * the engine reads whole files, the guard reads added lines.
 *
 * The whole trimmed value is the unit of comparison, exactly as the harvest
 * counts it, so "already in the system" means the same thing in both places.
 */

/** kind: the finding's name · re: how to spot it · learned: the harvest key */
export const EXTRA_KINDS = [
  { kind: 'radius', noun: 'border radius', plural: 'radii', re: /border-radius\s*:\s*([^;{}]+)/i, learned: 'radii' },
  { kind: 'fontsize', noun: 'font size', plural: 'font sizes', re: /(?:^|[^-\w])font-size\s*:\s*([^;{}]+)/i, learned: 'fontSizes' },
  { kind: 'shadow', noun: 'shadow', plural: 'shadows', re: /box-shadow\s*:\s*([^;{}]+)/i, learned: 'shadows' },
];

export const FONT_LINE_RE = /font-family\s*:\s*([^;{}]+)/i;

// One definition of "this value is a reference into the system", shared with
// the harvest's isTokenRef so the counter and the checker can never disagree
// about what a token reference looks like again (the 5.11 contradiction, and
// docs/variant-counting-findings.md §10). Fallbacks are allowed: var(--x, 4px)
// is still the system deciding.
export const TOKEN_REF_SRC = String.raw`var\(\s*--[\w-]+[^)]*\)|inherit|initial|unset|revert`;

// Disciplined values that are never sins: token use, resets, inheritance.
// Deliberately wider than a token reference: none, normal and 0 are resets a
// checker must not flag, but they reference nothing, so the counter ignores
// them. The difference is design, not drift.
export const BENIGN_VALUE_RE = new RegExp(`^(${TOKEN_REF_SRC}|none|normal|0)$`, 'i');
const FONT_BENIGN_RE = new RegExp(String.raw`^(var\(\s*--[\w-]+[^)]*\)|inherit)$`, 'i');

/** The first declaration of one kind on one line, or null. The guard's door. */
export function extraValue(re, text) {
  const m = re.exec(text);
  if (!m) return null;
  const v = m[1].trim().replace(/\s+/g, ' ');
  return BENIGN_VALUE_RE.test(v) ? null : v;
}

/** Every such declaration in a whole stylesheet, with positions. The engine's door. */
export function* extraDeclarations(text) {
  for (const { kind, noun, plural, re, learned } of EXTRA_KINDS) {
    for (const m of text.matchAll(new RegExp(re.source, 'gi'))) {
      const v = m[1].trim().replace(/\s+/g, ' ');
      if (BENIGN_VALUE_RE.test(v)) continue;
      yield { kind, noun, plural, learned, value: v, index: m.index + m[0].indexOf(m[1]) };
    }
  }
}

/** Every font-family declaration worth judging, raw value and position. */
export function* fontDeclarations(text) {
  for (const m of text.matchAll(new RegExp(FONT_LINE_RE.source, 'gi'))) {
    const raw = m[1].trim();
    if (FONT_BENIGN_RE.test(raw)) continue;
    yield { raw, index: m.index + m[0].indexOf(m[1]) };
  }
}
