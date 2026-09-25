/**
 * Validation engine — the shared core behind roast_validate, roast_review,
 * --check and (one day) the PR bot. Content in, findings out, measured with
 * the same detectors as the harvest so the MCP and the report never disagree.
 *
 * Honesty rules, load-bearing:
 *  - A clean result is "no measured violations found", never PASS. The list
 *    of what WAS checked ships with every result so nobody mistakes silence
 *    for certification.
 *  - Suggestions only point at things that exist in the repo. No token scale
 *    in the repo means saying so, not inventing one.
 */
import { extractStyling } from '../harvest/tokens.mjs';
import { definedComponents } from '../harvest/components.mjs';
import { hexRgb } from '../lib/nearpairs.mjs';
import { exemptReason } from '../lib/exempt.mjs';
import { extraDeclarations, fontDeclarations } from '../lib/declarations.mjs';
import { typefaceOf, GENERIC_FONTS } from '../lib/typefaces.mjs';
import { kitPaintFindings } from '../lib/kitpaint.mjs';
import { PALETTE_CLASS_RE, GREY_HUE_RE, DARK_WB_RE, DEMO_PATH_RE, blankComments } from '../harvest/paint.mjs';
import { TAILWIND_DEFAULTS } from '../profiles/tailwind-defaults.mjs';
import { oklab } from '../lib/color.mjs';
import { tokenTwinFindings } from '../lib/tokentwins.mjs';
import { avoidedImportFindings } from '../lib/avoidedimports.mjs';
import { isChartFile, chartFindings } from '../lib/charts.mjs';

// What this engine measures — shipped with every result, clean or not.
export const CHECKS = [
  'hardcoded colours vs the token set',
  'near-identical colour twins',
  'off-scale spacing',
  'off-scale radii, font sizes and shadows',
  'typefaces outside the system',
  'arbitrary bracket values',
  'static inline style blocks',
  '!important',
  'duplicate component definitions',
  'new colour tokens that twin an existing token',
  'imports of a duplicate the canonical copy replaces',
  'chart colours against the chart palette',
];
// What a kit or a Tailwind theme adds to the list, so a clean result on an
// MUI repo says the kit check ran.
export const KIT_CHECK = 'colours and pixel sizes written onto kit components where the theme has a value';
export const PALETTE_CHECK = 'palette classes where the theme names a colour';
export function checksFor(k) {
  if (k?.kit) return [...CHECKS, KIT_CHECK];
  if (k?.tailwind || k?.shadcn) return [...CHECKS, PALETTE_CHECK];
  return CHECKS;
}
// "an MUI component", "an Ant Design component", "a Mantine component"

const CSS_FILE_RE = /\.(css|scss|sass|less|styl)$/i;
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

// Tailwind's sanctioned pixel stops (scale step = px/4). Used only to NAME the
// nearest step when the repo demonstrably styles spacing through Tailwind.
const TW_PX = [0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 208, 224, 240, 256, 288, 320, 384];
function nearestTwStep(px) {
  let best = TW_PX[0];
  for (const p of TW_PX) if (Math.abs(p - px) < Math.abs(best - px)) best = p;
  return { px: best, step: best % 4 === 0 ? String(best / 4) : { 1: 'px', 2: '0.5', 6: '1.5', 10: '2.5', 14: '3.5' }[best] ?? String(best / 4) };
}
function toPx(len) {
  const m = /^(-?\d*\.?\d+)(px|rem|em)$/.exec(len);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] === 'px' ? n : n * 16;
}

/** Nearest token colour by channel distance; null when no tokens exist. */
function nearestToken(value, k) {
  const rgb = hexRgb(value);
  if (!rgb || !k.tokenColorRgb.length) return null;
  let best = null;
  for (const t of k.tokenColorRgb) {
    if (t.rgb.a !== rgb.a) continue;
    const d = Math.max(Math.abs(t.rgb.r - rgb.r), Math.abs(t.rgb.g - rgb.g), Math.abs(t.rgb.b - rgb.b));
    if (!best || d < best.d) best = { value: t.value, d };
  }
  return best;
}

/**
 * Validate one piece of content against the repo's knowledge.
 * @param content { text, file?, before? } — file name decides css-vs-code
 *   mode and lets the duplicate check excuse a component's own existing file;
 *   before is the same file at the last commit (null: a new file; left out:
 *   unknown), so a token or an import the change ADDS can be told from one
 *   that was already there
 * @returns { findings: [{ rule, severity, line, message, fix? }], checked,
 *   exempt? } — exempt is a sentence saying why the file was not judged
 */
export function validateContent(content, k) {
  const { text, file = null, before } = content;
  // Some files cannot be on-system by their nature. Judging them is how a
  // checker earns its reputation for crying wolf, and a checker people
  // distrust gets switched off. Say nothing, and say why nothing was said.
  const exempt = exemptReason(file, text);
  if (exempt) return { findings: [], checked: checksFor(k), exempt };
  const css = file ? CSS_FILE_RE.test(file) : looksLikeCss(text);
  const got = extractStyling(text, { css });
  const findings = [];
  const add = (rule, severity, index, message, fix) => findings.push({
    rule, severity, line: lineOf(text, index), message, ...(fix ? { fix } : {}),
  });

  // The knowledge scan includes the working tree, so a file under review has
  // already leaked its own values into the repo counts — without a discount,
  // a brand-new one-off looks like an established value the moment it is
  // saved. Subtract this content's own occurrences before judging "prior".
  const localColor = new Map(), localSpacing = new Map();
  for (const c of got.colors) localColor.set(c.value, (localColor.get(c.value) ?? 0) + 1);
  for (const s of got.spacing) localSpacing.set(s.value, (localSpacing.get(s.value) ?? 0) + 1);
  const discount = (repoCount, map, value) => Math.max(0, (repoCount ?? 0) - (file ? (map.get(value) ?? 0) : 0));

  // ---------- the kit's components ----------
  // On a kit file the kit's own rule comes first and says it in the kit's
  // words; the generic colour and spacing checks then stay quiet about the
  // same values, so one line is not reported twice.
  const kitPx = new Set();
  // On a kit file the kit judge owns colours: it sees every quoted colour and
  // knows which are not paint (a comment, a fallback after a theme read, a
  // compare, SVG artwork), so the generic check stays out of its way.
  let kitOwnsColours = false;
  // ---------- chart colours ----------
  // A chart's series colours are judged against the chart palette, or its
  // absence, by lib/charts.mjs: the report never counted them, the live
  // checks counted every one, and the same file got two verdicts. On a
  // chart file the chart rule owns colours; the kit judge and the generic
  // colour check stay out of its way.
  const chartFile = !css && !!k.charts && isChartFile(file, text);
  if (chartFile) {
    const paint = got.colors.filter((c) => !k.colorInfo.get(c.value)?.isToken);
    for (const f of chartFindings({ file, colours: paint, charts: k.charts, tokenFile: k.tokens.tokenFile })) add(f.rule, f.severity, f.index, f.message, f.fix);
  }
  if (k.kit?.def && !css && !chartFile) {
    const judged = kitPaintFindings(text, k.kit, { file });
    if (judged && !judged.exempt) {
      kitOwnsColours = true;
      for (const f of judged.findings) {
        if (f.rule === 'kit-px') kitPx.add(f.value.split(': ')[1]);
        add(f.rule, 'violation', f.index, f.message, f.fix);
      }
    }
  }

  // ---------- palette classes where the theme names its colours ----------
  // A Tailwind theme names its colours (bg-surface, text-ink); a shadcn sheet
  // names them too (bg-primary, text-muted-foreground). A palette class
  // (text-gray-500, ring-green-500) where a name of that kind exists is paint
  // from the tin. Same rule as the report's tile, from harvest/paint.mjs.
  // On a shadcn repo the catalogue and kit blocks are the kit's own doors
  // (editing them is the intended use) and a demo folder is not own code,
  // exactly the files the tile leaves out.
  const inShadcnDoors = (f) => !!f && k.shadcn.doors.some((d) => f === d || f.startsWith(`${d}/`));
  const paletteRule = k.tailwind ? 'tailwind'
    : k.shadcn && !(file && (inShadcnDoors(file) || DEMO_PATH_RE.test(file))) ? 'shadcn'
    : null;
  if (paletteRule && !css) {
    const tw = k.tailwind ?? {};
    const retuned = new Set(tw.retuned ?? []);
    const fam = tw.families ?? null;
    const hasFamily = (cls) => !fam || (GREY_HUE_RE.test(cls) ? fam.grey : fam.colour);
    const themeFile = paletteRule === 'tailwind' ? tw.file : (k.shadcn.sheet ?? 'the theme sheet');
    // the example name follows the utility: a text- class wants an ink or
    // foreground name, a bg- class a surface or background name
    const names = paletteRule === 'tailwind' ? (tw.names ?? []) : ['primary', 'foreground', 'muted-foreground', 'background', 'border'];
    const pick = (re) => names.find((n) => re.test(n)) ?? names[0] ?? 'brand';
    const values = paletteRule === 'tailwind' ? tw.values ?? {} : {};
    // a class named in a comment paints nothing; blanked, not cut, so the
    // line numbers below still hold
    const code = blankComments(text);
    const hits = [...code.matchAll(PALETTE_CLASS_RE)];
    // the evening override painted by hand (dark:bg-black) is the same sin
    // on a shadcn sheet, which always has a dark row of its own
    if (paletteRule === 'shadcn') hits.push(...code.matchAll(DARK_WB_RE));
    for (const m of hits.sort((a, b) => a.index - b.index)) {
      const cls = m[0];
      const util = cls.replace(/^((?:[\w-]+:)*[a-z]+)-.*$/, '$1');
      const shade = cls.replace(/^(?:[\w-]+:)*[a-z]+-/, '').replace(/\/\d+$/, '');
      const role = utilRole(util);
      // the theme colour nearest by value among the names that suit the
      // utility; the old pick by name alone only when none is close
      const example = nearestThemeName(shade, role, values)
        ?? (role === 'text' ? pick(/ink|text|fg|foreground/) : role === 'surface' ? pick(/surface|bg|background|canvas/) : pick(/border|edge|line|ring/));
      if (retuned.has(shade)) continue;
      if (!hasFamily(cls)) continue;
      const word = hueWord(shade, names);
      add('palette-class', 'violation', m.index,
        `Palette class ${cls} where the theme names its colours (${themeFile}).`,
        `Use a theme token as the class (${util}-${example}). ${names.includes(word)
          ? `If no token fits, add ${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word} shade to the theme once and use it by name.`
          : `If no token fits, add one to the theme once, for example ${word}, and use ${util}-${word}.`}`);
    }
  }

  // ---------- colours ----------
  const seenHere = new Set();
  for (const c of got.colors) {
    if (seenHere.has(`${c.value}:${c.index}`)) continue;
    seenHere.add(`${c.value}:${c.index}`);
    if (kitOwnsColours || chartFile) continue; // the kit judge or the chart rule said it, or judged it not paint
    const info = k.colorInfo.get(c.value);
    if (info?.isToken) continue; // it IS the token's value — the system can see it
    const near = nearestToken(c.value, k);
    const priors = discount(info?.count, localColor, c.value);
    if (near && near.d === 0) {
      add('hardcoded-colour', 'violation', c.index,
        `Hardcoded colour ${c.value} duplicates an existing token value.`,
        `Use the token that already holds ${near.value}${k.tokens.tokenFile ? ` (defined in ${k.tokens.tokenFile})` : ''}.`);
    } else if (near && near.d <= 8) {
      add('near-token-twin', 'violation', c.index,
        `${c.value} is visually identical to the token ${near.value}.`,
        `Use ${near.value}${k.tokens.tokenFile ? ` from ${k.tokens.tokenFile}` : ''}.`);
    } else if (k.tokenColors.length) {
      add('hardcoded-colour', 'violation', c.index,
        `Hardcoded colour ${c.value}${priors ? `. It already appears ${priors}x in this repo as a stray; adding another repetition makes it read as intent` : ' is new to this repo'}.`,
        near ? `Nearest token: ${near.value} (${near.d} channel steps away). If that is not the intent, add a token first.` : 'Add a token first if the colour is genuinely new.');
    } else {
      add('hardcoded-colour', 'warning', c.index,
        `Colour ${c.value}${priors ? ` already appears ${priors}x in this repo` : ' is new to this repo'}. No token set exists here to point you at; ${k.tokens.colors.length} distinct colours are already in play.`,
        'Reuse a colour the repo already has rather than adding to the count.');
    }
  }

  // ---------- spacing ----------
  for (const s of got.spacing) {
    if (kitPx.has(s.value)) continue; // the kit line above said it
    const px = toPx(s.value);
    const prior = discount(k.spacingSeen.get(s.value), localSpacing, s.value);
    if (k.usesTailwind) {
      const nearest = px !== null ? nearestTwStep(px) : null;
      add('off-scale-spacing', 'violation', s.index,
        `Raw spacing value ${s.value} in a repo that styles spacing through Tailwind${prior ? ` (already in play ${prior}x)` : ''}.`,
        nearest ? `Nearest scale step: ${nearest.step} (${nearest.px}px). If the design genuinely needs ${s.value}, that is a token, not a one-off.` : undefined);
    } else if (!prior) {
      add('off-scale-spacing', 'violation', s.index,
        `New one-off spacing value ${s.value}. The repo already carries ${k.spacingSeen.size} distinct spacing values.`,
        nearestRepoSpacing(s.value, k));
    }
    // a raw value the repo already uses, in a non-Tailwind repo, is consistency,
    // not a new offence — silence
  }
  const localArb = new Map();
  for (const a of got.arbitrary) localArb.set(a.value, (localArb.get(a.value) ?? 0) + 1);
  for (const a of got.arbitrary) {
    const repoArb = (k.tokens.tailwind?.arbitrary ?? []).find((x) => x.value === a.value);
    const priorArb = discount(repoArb?.count, localArb, a.value);
    add('arbitrary-value', 'violation', a.index,
      `Bracket value ${a.value}${priorArb ? `, already written outside the scale ${priorArb}x in this repo` : ''}.`,
      'If the value repeats it is a decision: name it as a token. If it does not, use the nearest scale step.');
  }

  // ---------- the other declared scales, and the typeface ----------
  // Stylesheets only. In code these live inside class strings, where the scale
  // is Tailwind's and the arbitrary-bracket check already covers straying off
  // it. The rule is the guard's rule: a value the repo already declares is
  // consistency, not a sin, and only a genuinely new one is worth saying.
  if (css) {
    const localExtras = new Map(), localFaces = new Map();
    for (const d of extraDeclarations(text)) {
      const key = `${d.kind}|${d.value}`;
      localExtras.set(key, (localExtras.get(key) ?? 0) + 1);
    }
    for (const f of fontDeclarations(text)) {
      const face = typefaceOf(f.raw);
      if (face) localFaces.set(face, (localFaces.get(face) ?? 0) + 1);
    }
    const SEEN = { radii: k.radiiSeen, fontSizes: k.fontSizesSeen, shadows: k.shadowsSeen };

    for (const d of extraDeclarations(text)) {
      const seen = SEEN[d.learned] ?? new Map();
      if (discount(seen.get(d.value), localExtras, `${d.kind}|${d.value}`) > 0) continue;
      const near = nearestDeclared(d.value, seen);
      const others = seen.size - (seen.has(d.value) ? 1 : 0);
      if (others) {
        add(`off-scale-${d.kind}`, 'violation', d.index,
          `New one-off ${d.noun} ${d.value}. The repo already declares ${others} other ${others === 1 ? d.noun : d.plural}.`,
          near ? `Closest value this repo already uses: ${near.value} (${near.count}x).`
            : `It matches none of them. If it is a real decision it is a token, not a one-off.`);
      } else {
        add(`off-scale-${d.kind}`, 'warning', d.index,
          `${d.value} is the first ${d.noun} this repo declares.`,
          `Nothing to compare it against yet. Put it in the token layer so the next ${d.noun} has a scale to join.`);
      }
    }

    for (const f of fontDeclarations(text)) {
      const face = typefaceOf(f.raw);
      if (!face || GENERIC_FONTS.has(face.toLowerCase())) continue;
      if (discount(k.faceCounts?.get(face), localFaces, face) > 0) continue;
      const declared = [...(k.faceCounts?.keys() ?? [])].filter((x) => x !== face);
      if (declared.length) {
        add('off-system-typeface', 'violation', f.index,
          `New typeface ${face}. The system already declares ${declared.join(', ')}.`,
          `Use a family the system declares, or add ${face} to the token layer before anything uses it.`);
      } else {
        add('off-system-typeface', 'warning', f.index,
          `${face} is the first typeface this repo declares.`,
          'Declare it once, in the token layer, so everything else can inherit it.');
      }
    }
  }

  // ---------- a new token that twins an existing one ----------
  // Minting a second name for a colour the system already has is drift
  // promoted into the token set: the strays that matched it stop counting and
  // the palette reads as tidier than it is (Ledgerly, 2026-09-24).
  if (css) {
    const twins = tokenTwinFindings(text, {
      before,
      others: (k.tokenDefs ?? []).filter((d) => d.file !== file),
      tailwind: !!k.tailwind || /@theme\b/.test(text),
    });
    for (const f of twins) add(f.rule, 'violation', f.index, f.message, f.fix);
  }

  // ---------- discipline ----------
  for (const b of got.inlineBlocks) {
    add('inline-style', 'violation', b.index,
      'Static inline style block. Styling in style={{ }} is invisible to the system and to every agent that reads it.',
      'Move the values to classes or tokens.');
  }
  for (const imp of got.important) {
    add('important', 'violation', imp.index,
      '!important forces a style through instead of fixing the rule that blocked it.',
      'Fix the selector or the source of the conflict instead of shouting over it.');
  }

  // ---------- duplicate components ----------
  if (!css) {
    for (const name of definedComponents(text)) {
      const existing = (k.byName.get(name) ?? []).filter((c) => !file || c.file !== file);
      if (!existing.length) continue;
      const dupe = k.dupeByName.get(name);
      // the scan may already include this very file — count the OTHER copies
      const otherCopies = dupe
        ? dupe.files.map((f) => (typeof f === 'string' ? f : f.file)).filter((f) => f !== file)
        : null;
      const best = [...existing].sort((a, b) => b.usageCount - a.usageCount)[0];
      add('duplicate-component', 'violation', text.indexOf(name),
        otherCopies && otherCopies.length > 1
          ? `Defines <${name}>, which already exists in ${otherCopies.length} other places. This makes ${otherCopies.length + 1} competing copies, and every wrong pick becomes the example the next agent copies.`
          : `Defines <${name}>, but ${best.file} already defines it${best.usageCount ? ` (used ${best.usageCount}x)` : ''}.`,
        `Import ${best.file} instead of creating a copy.`);
    }
  }

  // ---------- an import of the copy the canon replaces ----------
  if (!css) {
    for (const f of avoidedImportFindings(text, { file, before, dupes: k.dupeCopies })) {
      add(f.rule, 'violation', f.index, f.message, f.fix);
    }
  }

  return { findings, checked: checksFor(k) };
}

// ---------- the theme colour a palette class stands in for ----------
// Which theme names suit a utility, read from the name: a text class wants an
// ink, a bg class a surface, a border class an edge. A name that says none of
// these (brand, warning, positive) is an accent and suits every utility.
const TEXT_NAME_RE = /ink|text|fg|foreground/;
const SURFACE_NAME_RE = /surface|(^|-)bg(-|$)|background|canvas|soft|tint|wash/;
const EDGE_NAME_RE = /border|edge|line|ring|divider|outline/;
function utilRole(util) {
  if (/(^|:)(?:text|placeholder|caret|decoration|fill|stroke)$/.test(util)) return 'text';
  if (/(^|:)bg$/.test(util)) return 'surface';
  if (/(^|:)(?:border|ring|outline|divide)$/.test(util)) return 'edge';
  return 'any';
}
function suits(name, role) {
  const text = TEXT_NAME_RE.test(name), surface = SURFACE_NAME_RE.test(name), edge = EDGE_NAME_RE.test(name);
  if (role === 'any' || (!text && !surface && !edge)) return true;
  return role === 'text' ? text && !surface && !edge : role === 'surface' ? surface : edge;
}
// Distance in OKLab with the two colour axes doubled, so a pale amber lands on
// the pale warning surface rather than on the near-white canvas beside it.
const hueDistance = (x, y) => Math.hypot(x.L - y.L, 2 * (x.a - y.a), 2 * (x.b - y.b));
// Past this, the nearest theme colour is a different colour, not a stand-in
// (bg-blue-600 against a theme of greys), and the old pick by name answers.
const CLOSE = 0.2;
/** The suitable theme name nearest to a palette shade's Tailwind value, or null. */
function nearestThemeName(shade, role, values) {
  const from = oklab(TAILWIND_DEFAULTS[shade] ?? '');
  if (!from) return null;
  let best = null;
  for (const [name, value] of Object.entries(values)) {
    if (!suits(name, role)) continue;
    const to = oklab(value);
    if (!to) continue;
    const d = hueDistance(from, to);
    if (!best || d < best.d) best = { name, d };
  }
  return best && best.d <= CLOSE ? best.name : null;
}
// The word for a new token follows the hue, in the theme's own vocabulary when
// it has one (Ledgerly says positive and negative, not success and danger).
const HUE_WORDS = [
  [/^(?:red|rose)-/, ['negative', 'danger', 'error', 'destructive']],
  [/^(?:orange|amber|yellow)-/, ['warning', 'caution']],
  [/^(?:green|emerald|lime)-/, ['positive', 'success']],
  [/^(?:blue|sky|cyan)-/, ['info']],
];
function hueWord(shade, names) {
  const words = HUE_WORDS.find(([re]) => re.test(shade))?.[1];
  if (!words) return GREY_HUE_RE.test(`-${shade}`) ? 'muted' : 'accent';
  return words.find((w) => names.some((n) => n === w || n.startsWith(`${w}-`)))
    ?? { negative: 'danger', warning: 'warning', positive: 'success', info: 'info' }[words[0]];
}

function looksLikeCss(text) {
  // no JSX tags, has a `{ ...: ` declaration shape → treat as stylesheet.
  // Sniffed on the head of the text with bounded patterns: the old version
  // backtracked for seconds on a long run of word characters.
  const head = text.slice(0, 20_000);
  return !/<[A-Za-z][\w.]*[\s/>]/.test(head) && /\{[^}]{0,2000}:/.test(head);
}

/** Nearest value the repo already declares, for a scale that has lengths in it. */
function nearestDeclared(value, seen) {
  const px = toPx(value);
  if (px === null || !seen.size) return null;
  let best = null;
  for (const [v, count] of seen) {
    // the file under review is inside the scan, so the value being judged is
    // in this map too. Pointing at itself is not advice.
    if (v === value) continue;
    const p = toPx(v);
    if (p === null) continue;
    const d = Math.abs(p - px);
    if (!best || d < best.d) best = { value: v, count, d };
  }
  return best;
}

function nearestRepoSpacing(value, k) {
  const px = toPx(value);
  if (px === null || !k.spacingSeen.size) return undefined;
  let best = null;
  for (const [v, count] of k.spacingSeen) {
    if (count < 3) continue; // suggest only values the repo actually stands behind
    const p = toPx(v);
    if (p === null) continue;
    const d = Math.abs(p - px);
    if (!best || d < best.d) best = { value: v, count, d };
  }
  return best ? `Closest value this repo already uses: ${best.value} (${best.count}x).` : undefined;
}

/** The one-line honesty footer every clean result carries. */
export function cleanResultText(k = null) {
  return `No measured violations found. Checked: ${checksFor(k).join(', ')}.`;
}
