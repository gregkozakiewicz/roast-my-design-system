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

/**
 * The fallback in var(--x, #fefefe) is what shows if the variable is missing:
 * the declaration reads the theme, so the literal is not a value written by
 * hand. Blanked to spaces, so every index still points at the same place.
 *
 * One reader for the report and the live checks (10.1.5). Until then the
 * report blanked a fallback only in a stylesheet and only when it held no
 * brackets, so `var(--text, rgb(51, 51, 51))` and a fallback inside an inline
 * style were counted, and the live checks and the guard counted every one
 * (issue #2). A var() nested in the fallback is kept, with its own fallback
 * blanked, because it is a read of the theme too.
 */
export function blankVarFallbacks(text) {
  if (!text.includes('var(')) return text;
  const out = text.split('');
  const VAR_RE = /var\(\s*--[\w-]+\s*/g;
  // the index after the bracket that closes the var( opened before `from`
  const closeOf = (from) => {
    let depth = 1;
    for (let i = from; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')' && --depth === 0) return i;
    }
    return -1;
  };
  let m;
  while ((m = VAR_RE.exec(text))) {
    const afterName = m.index + m[0].length;
    if (text[afterName] !== ',') continue;
    const close = closeOf(afterName);
    if (close < 0) continue;
    for (let i = afterName + 1; i < close; i++) if (out[i] !== '\n') out[i] = ' ';
  }
  // put back each var(--name that sits inside a blanked fallback, and its
  // comma and closing bracket, so the nested read still parses as a read
  VAR_RE.lastIndex = 0;
  while ((m = VAR_RE.exec(text))) {
    const afterName = m.index + m[0].length;
    for (let i = m.index; i < afterName; i++) out[i] = text[i];
    if (text[afterName] === ',') { out[afterName] = ','; const c = closeOf(afterName); if (c >= 0) out[c] = ')'; }
    else if (text[afterName] === ')') out[afterName] = ')';
  }
  return out.join('');
}
