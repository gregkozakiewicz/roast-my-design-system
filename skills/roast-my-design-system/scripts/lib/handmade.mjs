/**
 * Hand-made buttons where the repo already has a Button.
 *
 * The bad-neighbour tests on Twenty (2026-09-29): with the edit hook on,
 * Haiku reached zero value findings and still hand-made the button four
 * times in five, with clean token colours. The value checks cannot see the
 * choice; this one does. Buttons only, for now.
 *
 * Fleet probe, 204 clones (2026-09-29): 52 have a Button, 38 of those still
 * hand-make buttons in page files, but most of those are clickable rows,
 * tabs, toggles and "show more" links on a button tag for keyboard access,
 * which nobody wants replaced. So the trigger is narrow: an element DRESSED
 * as a button (a real background plus padding, a border or a radius), or
 * one that calls itself a button by name and renders the raw tag. A reset
 * (background: none; border: 0) is a row, not a button, and stays silent.
 *
 * The Button it points at must be visible from the file's own package. In
 * Twenty the most-used Button is the marketing site's (313 uses); the app
 * imports its own from twenty-ui. Pointing the app at the website's button
 * would be worse than silence.
 */

import { posix } from 'node:path';

const stripExt = (f) => f.replace(/\.[jt]sx?$/, '').replace(/\/index$/, '');

/** Imports of a Button below this are a stray, not the repo's answer. */
export const BUTTON_MIN_USES = 20;

const NOT_OWN_CODE_RE = /(^|\/)(stories|__stories__|__tests__|__mocks__|test|tests|spec|docs?|examples?|playground|storybook|showcase|sandbox|demo|fixtures?)\/|\.(stories|test|spec)\.[jt]sx?$|(Sandbox|Showcase|Demo|Playground)\.[jt]sx?$/;
// the system's own layer: a Button-ish thing here is the system being built
const SYSTEM_LAYER_RE = /(^|\/)(ui|design-system|primitives|core)\/|[\w.-]*button[\w.-]*\.[jt]sx?$/i;
// A name that says the element is not the action button: a close cross, a
// chevron, a tab, a chip, a row that happens to be focusable. The fleet
// probe (five repos, 2026-09-29) found these were most of the styled
// buttons in page files, and none of them wants the Button.
const OTHER_ROLE_RE = /(Icon|Close|Toggle|Expand|Collapse|Tab|Pill|Chip|Row|Item|Menu|Delete|Remove|Clear|Trigger|Header|Segment|Switch|Mode|Dot|Hidden|Tooltip|Info|Avatar|Handle|Link|Nav|Thumb|Step|Card|Tile|Option|Cell|Accordion|Summary|Tree|Folder|Image|Query|Checkbox|Radio|Swatch|Uploader|Container|Place|Bar|Control|Filter|Select|Value|Indicator)/;

// Dressed as a button: real padding, and a real background or a real border.
// A reset (background: none; border: 0; padding: 0) is a row, not a button.
// An outline button has a border and padding but no background, so either
// paint counts (Twenty's wizard SecondaryButton, 2026-09-29).
// `\s*(?!\s)` pins the value's start: without it the regex backtracks past
// the space after the colon and reads "background: none" as paint
const REAL_BG = /(?:^|[\s;{])background(?:-color)?\s*:\s*(?!\s)(?!(?:none|transparent|inherit|unset|initial)\s*[;}])[^;}]*[;}]/i;
const REAL_BORDER = /(?:^|[\s;{])border(?:-(?:top|bottom|left|right))?\s*:\s*(?!\s)(?!(?:none|0|0px|unset)\s*[;}])[^;}]*[;}]/i;
const REAL_PAD = /(?:^|[\s;{])padding(?:-(?:top|bottom|left|right|inline|block))?\s*:\s*(?!\s)(?!0(?:px)?\s*[;}])[^;}]*[;}]/i;
// a pseudo-state block (&:hover { background: ... }) is a state, not the
// resting paint; a class variant block (&.primary { ... }) still counts
// `${...}` interpolations carry braces of their own (arrow functions,
// destructured props), so they are blanked first, by brace count, and each
// reads as a value, not as an empty one
const blankInterpolations = (body) => {
  let out = '', i = 0;
  while (i < body.length) {
    if (body[i] === '$' && body[i + 1] === '{') {
      let depth = 0, j = i + 1;
      for (; j < body.length; j++) { if (body[j] === '{') depth++; else if (body[j] === '}' && --depth === 0) break; }
      out += '_'; i = j + 1;
    } else out += body[i++];
  }
  return out;
};
const stripStates = (body) => blankInterpolations(body).replace(/&?(?::[\w-]+(?:\([^)]*\))?|\[[^\]]*\])+\s*\{[^{}]*\}/g, ' ');
// An action button carries a label the designer set (a weight, a size, a
// transform). A card, a select trigger or a list row on a button tag reads
// differently: text to the left, content spread apart, a column, a stretch
// to fill the row, or a fixed position. Fleet probe, fifteen repos
// (2026-09-29): those tells were nearly every innocent hit.
const LABEL_CSS = /(?:^|[\s;{])(?:font-weight|font-size|text-transform|font-family|letter-spacing)\s*:/i;
const OTHER_SHAPE_CSS = /(?:^|[\s;{])(?:text-align\s*:\s*left|justify-content\s*:\s*space-between|flex-direction\s*:\s*column|flex\s*:\s*1\b|width\s*:\s*100%|position\s*:\s*(?:absolute|fixed))/i;
const dressedCss = (raw) => {
  const body = stripStates(raw);
  return REAL_PAD.test(body) && (REAL_BG.test(body) || REAL_BORDER.test(body)) && LABEL_CSS.test(body) && !OTHER_SHAPE_CSS.test(body);
};

// class strings: a bare bg- or border class (a hover: or focus: variant is a
// state, not the resting paint) plus non-zero padding
const TW_BG = /(?:^|\s)bg-(?!transparent|inherit|none)[\w[\]#/.-]/;
const TW_BORDER = /(?:^|\s)border(?:\s|$|-(?!none|0(?:\s|$)|transparent)[\w[\]#/.-]*)/;
// vertical padding of a full step or more: a badge (py-0.5), an avatar ring
// (p-0.5) or a select trigger sized by height alone is not a button
const TW_PAD = /(?:^|\s)p(?:y)?-(?:[1-9]\d*(?:\.\d+)?|\[)/;
const TW_LABEL = /(?:^|\s)(?:font-(?:medium|semibold|bold|black)|text-white|text-[\w-]*foreground|uppercase)(?:\s|$)/;
const TW_OTHER_SHAPE = /(?:^|\s)(?:text-left|justify-between|flex-col|items-start|placeholder:[\w-]+|absolute|fixed|hidden|invisible|border-dashed|rounded-full|(?:h|w|size)-(?:\d+|\[[^\]]*\])(?=\s|$))/;
const dressedClasses = (cls) => TW_PAD.test(cls) && (TW_BG.test(cls) || TW_BORDER.test(cls)) && TW_LABEL.test(cls) && !TW_OTHER_SHAPE.test(cls);

const INLINE_BG = /background(?:Color)?\s*:\s*(?!\s)['"`](?!transparent|none|inherit)/;
const INLINE_BORDER = /border(?:Top|Bottom|Left|Right)?\s*:\s*(?!\s)['"`](?!none|0)/;
const INLINE_PAD = /padding(?:Top|Bottom|Left|Right)?\s*:\s*(?!\s)(?!0(?:[,\s}]|$)|['"`]0(?:px)?['"`])/;
const INLINE_LABEL = /(?:fontWeight|fontSize|textTransform|fontFamily)\s*:/;
const dressedInline = (style) => INLINE_PAD.test(style) && (INLINE_BG.test(style) || INLINE_BORDER.test(style)) && INLINE_LABEL.test(style);

/**
 * The hand-made buttons in a piece of component code, each with where it
 * starts and how it gave itself away.
 * @returns [{ index, name, how }]  how: 'styled' | 'tag'
 */
export function handmadeButtons(text) {
  const out = [];
  const src = String(text ?? '');

  // const StyledX = styled.button`...`  /  styled('button')({...})
  for (const m of src.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*styled(?:\.button|\(\s*['"]button['"]\s*\))(?:<[^`(]*?>)?\s*(?:`([\s\S]*?)`|\(\s*\{([\s\S]*?)\}\s*\))/g)) {
    const name = m[1];
    if (OTHER_ROLE_RE.test(name)) continue;
    // an object style ({ backgroundColor: '#fff', padding: 8 }) read as CSS
    const body = m[2] ?? `${(m[3] ?? '').replace(/,/g, ';').replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`)};`;
    if (dressedCss(body)) out.push({ index: m.index, name, how: 'styled' });
  }

  // <button className="bg-brand px-4 py-2">  /  <button style={{ background: ..., padding: ... }}>
  for (const m of src.matchAll(/<button\b([^>]*)>/g)) {
    const attrs = m[1];
    const cls = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/.exec(attrs);
    const style = /style\s*=\s*\{\{([^}]*)\}\}/.exec(attrs);
    if ((cls && dressedClasses(cls[1] ?? cls[2] ?? cls[3] ?? '')) || (style && dressedInline(style[1]))) out.push({ index: m.index, name: null, how: 'tag' });
  }
  return out.sort((a, b) => a.index - b.index);
}

/**
 * How the repo imports THIS Button, read from the files that use it: the
 * most common specifier that resolves to the definition. A relative path
 * resolves by position, an alias (@/ui/Button) by its tail, a package name
 * by the workspace it names. The harvest credits every same-named copy when
 * it cannot resolve a package import, so its usedIn for the website's
 * Button holds app files importing twenty-ui/input; asking "which spec
 * resolves to this file" is what keeps the answer honest.
 */
function importSpecOf(def, read, workspaces) {
  const counts = new Map();
  const stem = stripExt(def.file);
  const resolves = (spec, from) => {
    if (spec.startsWith('.')) {
      const target = posix.normalize(posix.join(posix.dirname(from), spec));
      return stem === target || stem === `${target}/index` || def.file.startsWith(`${target}/`);
    }
    const alias = /^[@~#]\/(.+)$/.exec(spec);
    if (alias) return stem.endsWith(`/${alias[1]}`) || stem.endsWith(`/${alias[1]}/index`) || def.file.includes(`/${alias[1]}/`);
    const ws = (workspaces ?? []).find((w) => spec === w.name || spec.startsWith(`${w.name}/`));
    return !!ws && def.file.startsWith(`${ws.dir}/`);
  };
  for (const f of def.usedIn ?? []) {
    const text = read(f);
    if (!text) continue;
    for (const m of text.matchAll(/import\s+(?:type\s+)?([^'";]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
      if (!/\bButton\b/.test(m[1])) continue;
      if (resolves(m[2], f)) counts.set(m[2], (counts.get(m[2]) ?? 0) + 1);
      break;
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * The Buttons a repo could answer with: every reusable component called
 * Button, in the team's own code, imported at least BUTTON_MIN_USES times.
 * @returns [{ file, usageCount, spec }]  spec: how the repo imports it, proven
 */
export function buttonCandidates(components, read, workspaces = []) {
  return components
    .filter((c) => c.name === 'Button' && !c.isPage && c.usageCount >= BUTTON_MIN_USES && !NOT_OWN_CODE_RE.test(c.file))
    .map((c) => ({ file: c.file, usageCount: c.usageCount, spec: importSpecOf(c, read, workspaces) }))
    // no file provably imports it (an alias the repo resolves elsewhere, or a
    // name the harvest credited from other copies): no answer to point at
    .filter((c) => c.spec)
    .sort((a, b) => b.usageCount - a.usageCount);
}

/** The workspace package a file belongs to, or null. */
export const packageOf = (file, workspaces) =>
  (workspaces ?? []).filter((w) => file === w.dir || file.startsWith(`${w.dir}/`)).sort((a, b) => b.dir.length - a.dir.length)[0] ?? null;

/**
 * The Button a file should reach for: the most-used candidate visible from
 * the file's package (its own, one it depends on, or code outside every
 * package). Null when the repo has no answer for this file.
 */
export function buttonFor(file, { buttons = [], workspaces = [], packageDeps = new Map() } = {}) {
  if (!buttons.length) return null;
  const mine = file ? packageOf(file, workspaces) : null;
  const deps = mine ? packageDeps.get(mine.dir) ?? new Set() : new Set();
  const visible = buttons.filter((b) => {
    const theirs = packageOf(b.file, workspaces);
    if (!mine || !theirs) return true;
    return theirs.dir === mine.dir || deps.has(theirs.name);
  });
  return visible[0] ?? null;
}

/**
 * Findings for the hand-made buttons in a file, against the Button the repo
 * answers with. Warnings: the check has not yet earned a violation.
 */
export function handmadeButtonFindings(text, { file = null } = {}, k) {
  if (!file || SYSTEM_LAYER_RE.test(file) || NOT_OWN_CODE_RE.test(file)) return [];
  const button = buttonFor(file, k);
  if (!button) return [];
  const out = [];
  for (const h of handmadeButtons(text)) {
    const what = h.how === 'styled' ? `A styled button (${h.name})` : 'A button tag styled by hand';
    out.push({
      rule: 'handmade-button', severity: 'warning', index: h.index,
      message: `${what} where the repo already has <Button> (imported ${button.usageCount}x${button.spec ? ` from ${button.spec}` : `, ${button.file}`}).`,
      fix: `Use ${button.spec ? `import { Button } from '${button.spec}'` : `the Button in ${button.file}`}. If it needs a kind the Button lacks, add a variant there rather than a new button here.`,
    });
  }
  return out;
}
