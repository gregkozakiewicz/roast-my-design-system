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

// What this engine measures — shipped with every result, clean or not.
export const CHECKS = [
  'hardcoded colours vs the token set',
  'near-identical colour twins',
  'off-scale spacing',
  'arbitrary bracket values',
  'static inline style blocks',
  '!important',
  'duplicate component definitions',
];

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
 * @param content { text, file? } — file name decides css-vs-code mode and
 *   lets the duplicate check excuse a component's own existing file
 * @returns { findings: [{ rule, severity, line, message, fix? }], checked }
 */
export function validateContent(content, k) {
  const { text, file = null } = content;
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

  // ---------- colours ----------
  const seenHere = new Set();
  for (const c of got.colors) {
    if (seenHere.has(`${c.value}:${c.index}`)) continue;
    seenHere.add(`${c.value}:${c.index}`);
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
      `Arbitrary bracket ${a.value}${priorArb ? `, already punched through the scale ${priorArb}x in this repo` : ''}.`,
      'If the value repeats it is a decision: name it as a token. If it does not, use the nearest scale step.');
  }

  // ---------- discipline ----------
  for (const b of got.inlineBlocks) {
    add('inline-style', 'violation', b.index,
      'Static inline style block. Styling in style={{ }} is invisible to the system and to every agent that reads it.',
      'Move the values to classes or tokens.');
  }
  for (const imp of got.important) {
    add('important', 'violation', imp.index,
      '!important is the cascade admitting defeat.',
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

  return { findings, checked: CHECKS };
}

function looksLikeCss(text) {
  // no JSX tags, has selector-brace patterns → treat as stylesheet
  return !/<[A-Za-z][\w.]*[\s/>]/.test(text) && /[.#:\w[\]-]+\s*\{[^}]*:/.test(text);
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
export function cleanResultText() {
  return `No measured violations found. Checked: ${CHECKS.join(', ')}.`;
}
