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
import { componentNamesIn, isPageFile } from '../harvest/components.mjs';
import { duplicateCopies } from '../harvest/duplicates.mjs';
import { hexRgb } from '../lib/nearpairs.mjs';
import { exemptReason, isDrawing, SVG_MARKUP_RE } from '../lib/exempt.mjs';
import { extraDeclarations, fontDeclarations } from '../lib/declarations.mjs';
import { typefaceOf, GENERIC_FONTS } from '../lib/typefaces.mjs';
import { kitPaintFindings } from '../lib/kitpaint.mjs';
import { installedFile } from '../profiles/installed.mjs';
import { paletteFindings } from '../lib/palette.mjs';
import { tokenTwinFindings } from '../lib/tokentwins.mjs';
import { avoidedImportFindings } from '../lib/avoidedimports.mjs';
import { isChartFile, chartFindings } from '../lib/charts.mjs';
import { handmadeButtonFindings } from '../lib/handmade.mjs';

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
export const BUTTON_CHECK = 'hand-made buttons where the repo has a Button';
export function checksFor(k) {
  const list = k?.kit ? [...CHECKS, KIT_CHECK] : k?.palette ? [...CHECKS, PALETTE_CHECK] : [...CHECKS];
  if (k?.buttons?.length) list.push(BUTTON_CHECK);
  return list;
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
 * The report's answer on duplicates, asked of one file: a name that repeats
 * by design, a pair the report lists without counting and a file that
 * defines nothing the report reads are not duplicates here either
 * (harvest/duplicates.mjs).
 */
function duplicateFindings({ text, file, k, add }) {
  for (const name of componentNamesIn(text, file)) {
    const dupe = k.dupeByName.get(name);
    const counted = dupe ? dupe.files.map((f) => (typeof f === 'string' ? f : f.file)) : null;
    const existing = duplicateCopies({ name, file: file ?? '', isPage: !!file && isPageFile(file), drawing: isDrawing(file ?? '', text), draws: SVG_MARKUP_RE.test(text) }, k.byName.get(name), counted);
    if (!existing.length) continue;
    // the scan may already include this very file — count the OTHER copies
    const otherCopies = counted ? counted.filter((f) => f !== file) : null;
    const best = [...existing].sort((a, b) => b.usageCount - a.usageCount)[0];
    add('duplicate-component', 'violation', text.indexOf(name),
      otherCopies && otherCopies.length > 1
        ? `Defines <${name}>, which already exists in ${otherCopies.length} other places. This makes ${otherCopies.length + 1} competing copies, and every wrong pick becomes the example the next agent copies.`
        : `Defines <${name}>, but ${best.file} already defines it${best.usageCount ? ` (used ${best.usageCount}x)` : ''}.`,
      `Import ${best.file} instead of creating a copy.`);
  }
}

/**
 * Validate one piece of content against the repo's knowledge.
 * @param content { text, file?, before? } — file name decides css-vs-code
 *   mode and lets the duplicate check excuse a component's own existing file;
 *   before is the same file at the last commit (null: a new file; left out:
 *   unknown), so a token or an import the change ADDS can be told from one
 *   that was already there
 * @returns { findings: [{ rule, severity, line, message, fix? }], checked,
 *   exempt? } — exempt is a sentence saying why the file's styling was not
 *   judged; its findings are then duplicates only, and checked says so
 */
export function validateContent(content, k) {
  const { text, file = null, before } = content;
  // Some files cannot be on-system by their nature. Judging them is how a
  // checker earns its reputation for crying wolf, and a checker people
  // distrust gets switched off. Say nothing, and say why nothing was said.
  const exempt = exemptReason(file, text, { email: k.email });
  const css = file ? CSS_FILE_RE.test(file) : looksLikeCss(text);
  const findings = [];
  const add = (rule, severity, index, message, fix) => findings.push({
    rule, severity, line: lineOf(text, index), message, ...(fix ? { fix } : {}),
  });
  // The exemption is about styling: what an email, a drawing or a crash page
  // cannot take from the system. A second copy of a component is a second
  // copy in any medium, and the report counts it, so that one check still
  // runs and the result says it was the only one.
  if (exempt) {
    if (!css) duplicateFindings({ text, file, k, add });
    return { findings, checked: css ? [] : ['duplicate component definitions'], exempt };
  }
  const got = extractStyling(text, { css });

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
    const judged = kitPaintFindings(text, k.kit, { file, email: k.email });
    if (judged && !judged.exempt) {
      kitOwnsColours = true;
      for (const f of judged.findings) {
        if (f.rule === 'kit-px') kitPx.add(f.value.split(': ')[1]);
        // a value on another kit's component is a warning: the first kit's
        // fix does not reach it, so the end-of-turn review leaves it out
        add(f.rule, f.severity ?? 'violation', f.index, f.message, f.fix);
      }
    }
  }

  // ---------- palette classes where the theme names its colours ----------
  // One rule for every door (lib/palette.mjs): which vocabulary applies, a
  // Tailwind theme, shadcn's sheet or the repo's own theme under a shadcn
  // kit, was decided once by the profile. The catalogue, kit blocks and demo
  // folders are left out there, the same files the report's tile leaves out,
  // and utility-class mode switches the rule off, as the report scores it.
  for (const f of paletteFindings(text, k.palette, { file, css })) add(f.rule, f.severity, f.index, f.message, f.fix);

  // ---------- colours ----------
  const seenHere = new Set();
  const statesTokens = !!file && k.tokenSources?.has(file);
  for (const c of got.colors) {
    if (seenHere.has(`${c.value}:${c.index}`)) continue;
    seenHere.add(`${c.value}:${c.index}`);
    if (kitOwnsColours || chartFile) continue; // the kit judge or the chart rule said it, or judged it not paint
    const info = k.colorInfo.get(c.value);
    // A token's raw value is the definition only inside a file that states
    // the palette (a token stylesheet, a Tailwind config, a kit theme). In a
    // component it is the value pasted where the name belongs: the system
    // cannot see it, and the next reader copies the hex. Until 9.1.3 every
    // exact match walked free, and hooked agents on Twenty wrote
    // background: #4a38f5 with a clean bill (2026-09-29).
    if (info?.isToken && statesTokens) continue;
    const near = nearestToken(c.value, k);
    const priors = discount(info?.count, localColor, c.value);
    if (near && near.d === 0) {
      const names = k.tokenNames?.get(c.value) ?? [];
      const by = names.length ? `${css ? `var(${names[0]})` : names[0]}` : `the token that already holds ${near.value}`;
      add('hardcoded-colour', 'violation', c.index,
        `Hardcoded colour ${c.value} duplicates an existing token value.`,
        `Use ${by}${k.tokens.tokenFile ? ` (defined in ${k.tokens.tokenFile})` : ''}.`);
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

  // ---------- the choice, not the value: a button from scratch ----------
  // The value checks above cannot see it. Hooked agents on Twenty passed
  // them and still hand-made the button four times in five (2026-09-29).
  if (!css) for (const f of handmadeButtonFindings(text, { file }, k)) add(f.rule, f.severity, f.index, f.message, f.fix);

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
  // Bracket values inside installed code (shadcn's own components, kit
  // blocks, registries) are the kit's own choices. The report names them and
  // keeps them out of the count; a file under review is judged by the same
  // line, file by file: a component of the team's own kept in the catalogue
  // folder is the team's (profiles/installed.mjs, 9.5.0).
  const installed = !!file && installedFile(k.installedFrom, file);
  const localArb = new Map();
  for (const a of got.arbitrary) localArb.set(a.value, (localArb.get(a.value) ?? 0) + 1);
  for (const a of installed ? [] : got.arbitrary) {
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
  if (!css) duplicateFindings({ text, file, k, add });

  // ---------- an import of the copy the canon replaces ----------
  if (!css) {
    for (const f of avoidedImportFindings(text, { file, before, dupes: k.dupeCopies })) {
      add(f.rule, 'violation', f.index, f.message, f.fix);
    }
  }

  return { findings, checked: checksFor(k) };
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
