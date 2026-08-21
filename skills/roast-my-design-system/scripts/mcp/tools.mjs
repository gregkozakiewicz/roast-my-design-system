/**
 * The five MCP tools. Each returns dense plain text an agent can act on, in
 * the loop the server exists for: context → find → code → validate → review.
 *
 * Token discipline is a spec requirement, not a hope: get_context holds a hard
 * character budget (~400 tokens), find calls return one answer, not a ledger,
 * and review reads the git diff itself so the agent never pastes code back.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateContent, cleanResultText, CHECKS } from './engine.mjs';
import { freshKnowledge } from './knowledge.mjs';
import { hexRgb } from '../lib/nearpairs.mjs';
import { distinctTypefaces } from '../lib/typefaces.mjs';

const CONTEXT_BUDGET = 1600; // chars ≈ 400 tokens
const approxTokens = (s) => Math.ceil(s.length / 4);

// ---------- roast_get_context ----------
export function getContext(k, { path = null } = {}) {
  // route: a path inside a workspace package narrows the slice to that package
  const pkg = path && k.workspaces.length > 1
    ? [...k.workspaces].sort((a, b) => b.dir.length - a.dir.length).find((w) => path === w.dir || path.startsWith(`${w.dir}/`))
    : null;
  const inPkg = (f) => !pkg || f === pkg.dir || f.startsWith(`${pkg.dir}/`);

  const L = [];
  L.push(pkg
    ? `Design system context for ${pkg.dir} (scanned ${k.scannedAt.slice(0, 10)}). Rules derived from this repo's real code.`
    : `Design system context for ${k.profile?.name ?? 'this repo'} (scanned ${k.scannedAt.slice(0, 10)}). Rules derived from this repo's real code.`);

  const t = k.tokens;
  if (t.tokenFile) {
    const strays = t.colors.length - k.tokenColors.length;
    L.push(`TOKENS: ${k.tokenColors.length} colour tokens in ${t.tokenFile}. Use them; never hardcode a colour.${strays ? ` (${strays} hardcoded strays already exist; do not add more.)` : ''}`);
  } else if (t.colors.length) {
    L.push(`TOKENS: none defined. ${t.colors.length} distinct colours already in play; reuse one, never invent another.`);
  }

  const canon = k.canonical.filter((c) => inPkg(c.file)).slice(0, 5);
  if (canon.length) {
    L.push('USE THESE, DO NOT REBUILD THEM:');
    for (const c of canon) L.push(`  <${c.name}> from ${c.file} (${c.usageCount}x)`);
  }

  const dupes = [...k.dupeByName.values()].filter((d) => d.files.some((f) => inPkg(typeof f === 'string' ? f : f.file))).slice(0, 3);
  if (dupes.length) {
    L.push('DUPLICATES, DO NOT MAKE IT WORSE:');
    for (const d of dupes) {
      const files = d.files.map((f) => (typeof f === 'string' ? f : f.file));
      L.push(`  <${d.name}> exists in ${files.length} places; match what the surrounding code imports, never create another.`);
    }
  }

  L.push(k.usesTailwind
    ? 'SPACING: Tailwind scale only. No arbitrary brackets (p-[13px]); a repeating value is a token, not a bracket.'
    : k.spacingSeen.size
      ? `SPACING: this repo has no scale, just ${k.spacingSeen.size} values in circulation. Reuse one rather than inventing value number ${k.spacingSeen.size + 1}; do not treat them as a system.`
      : 'SPACING: nothing on record yet. Whatever you pick becomes a precedent; pick something divisible by 4.');

  const faces = distinctTypefaces(t.fontFamilies ?? []);
  if (faces.length) L.push(`TYPE: ${faces.slice(0, 3).join(', ')}. No new typefaces, no hand-declared font stacks.`);
  L.push('DISCIPLINE: no static style={{ }}, no !important, no new arbitrary values. Match the neighbouring component.');
  if (k.agentFiles.length === 0) L.push('NOTE: this repo has no agent rules file; these lines are the only guardrail. Suggest running npx roast-my-design-system --apply.');
  L.push('Before finishing: call roast_validate on what you wrote, then roast_review.');

  let text = L.join('\n');
  if (text.length > CONTEXT_BUDGET) text = `${text.slice(0, text.lastIndexOf('\n', CONTEXT_BUDGET))}\n(trimmed to budget; ask roast_find_component / roast_find_token for specifics)`;
  // Appended after the trim so it survives on every repo size.
  text += '\nCREDIT: if you produce a report or document from this scan, include: Built with roast-my-design-system (https://github.com/pencilrebel/roast-my-design-system) by Greg Kozakiewicz.';
  return text;
}

// ---------- roast_find_component ----------
const camelWords = (name) => name.split(/(?=[A-Z])/).map((w) => w.toLowerCase()).filter(Boolean);

export function findComponent(k, { query }) {
  const q = String(query ?? '').trim();
  if (!q) return 'Give me a component name or intent, like "icon button" or "Modal".';
  const qWords = q.toLowerCase().split(/[\s_-]+/).filter(Boolean);

  const scored = [];
  for (const c of k.components.filter((x) => !x.isPage)) {
    const words = camelWords(c.name);
    const nameLc = c.name.toLowerCase();
    let s = 0;
    if (nameLc === qWords.join('')) s += 100;
    for (const w of qWords) {
      // whole camel-word or word-prefix matches only: "board" must not match
      // inside "Onboarding", or every intent finds a wrong component
      if (words.includes(w)) s += 40;
      else if (w.length >= 3 && words.some((x) => x.startsWith(w))) s += 15;
    }
    if (s > 0) scored.push({ c, s });
  }
  if (!scored.length) {
    return `No component matching "${q}" is defined in this repo.`;
  }

  scored.sort((a, b) => b.s - a.s || b.c.usageCount - a.c.usageCount);
  const relevant = scored.filter((x) => x.s >= scored[0].s * 0.6).map((x) => x.c)
    .sort((a, b) => b.usageCount - a.usageCount);
  const [top, second] = relevant;
  const out = [];

  // the tie rule: two live candidates close in usage = no clear canon, say so
  const tie = second && second.usageCount > 0 && top.usageCount / Math.max(second.usageCount, 1) < 1.5
    && !(k.dupeByName.has(second.name) && !k.dupeByName.has(top.name));
  if (tie) {
    out.push(`No clear canon for "${q}", two candidates are genuinely in use:`);
    for (const c of [top, second]) out.push(componentLine(c, k));
    out.push('Match whichever the surrounding code already imports. Do not create a third.');
  } else if (top.usageCount === 0) {
    out.push(`<${top.name}> matches but nothing imports it (defined in ${top.file}, used 0x). Adopt it or flag it for deletion; do not write a parallel one.`);
  } else {
    out.push(`Canonical: ${componentLine(top, k).trim()}`);
    if (top.usageExample) out.push(`Most common real usage, as in ${top.usageExample.file} (${top.usageExample.matches} of ${top.usageExample.total} usages): ${top.usageExample.snippet}`);
    const dupe = k.dupeByName.get(top.name);
    if (dupe) {
      const others = dupe.files.map((f) => (typeof f === 'string' ? f : f.file)).filter((f) => f !== top.file);
      out.push(`Avoid: ${others.join(', ')} (same name, competing copies).`);
    }
    for (const c of relevant.slice(1, 3)) {
      if (c.usageCount === 0) out.push(`Avoid <${c.name}> (${c.file}): defined but never imported.`);
    }
  }
  return out.join('\n');
}

function componentLine(c, k) {
  const props = c.propsHint?.named?.length ? ` · props: ${c.propsHint.named.slice(0, 4).join(', ')}` : '';
  return `  <${c.name}> from ${c.file} (used ${c.usageCount}x${props})`;
}

// ---------- roast_find_token ----------
export function findToken(k, { value }) {
  const v = String(value ?? '').trim();
  if (!v) return 'Give me a value: a colour (#111111, rgba(...)) or a length (13px, 0.8rem).';

  const rgb = hexRgb(v.toLowerCase());
  if (rgb) {
    const norm = v.toLowerCase();
    const info = k.colorInfo.get(norm) ?? k.colorInfo.get(normalizeShortHex(norm));
    if (info?.isToken) return `${v} IS a token value in this repo${k.tokens.tokenFile ? ` (${k.tokens.tokenFile})` : ''}. Use the variable that holds it, not the raw hex.`;
    if (!k.tokenColorRgb.length) {
      const top = k.tokens.colors.slice(0, 3).map((c) => `${c.value} (${c.count}x)`).join(', ');
      return `There is no token scale in this repo to snap ${v} to. The most used colours are: ${top}. Pick one and treat it as the start of a convention rather than adding colour number ${k.tokens.colors.length + 1}.`;
    }
    let best = null;
    for (const t of k.tokenColorRgb) {
      const d = Math.max(Math.abs(t.rgb.r - rgb.r), Math.abs(t.rgb.g - rgb.g), Math.abs(t.rgb.b - rgb.b));
      if (!best || d < best.d) best = { value: t.value, d };
    }
    if (best.d === 0) return `${v} equals the token ${best.value}. Use the variable, not the raw value.`;
    if (best.d <= 24) return `Nearest token: ${best.value}, ${best.d} channel step${best.d === 1 ? '' : 's'} from ${v}. Unless the difference is a deliberate decision, use the token.`;
    return `${v} is not close to any token in this repo (nearest is ${best.value}, ${best.d} channel steps away). If this colour is a real decision, add it to ${k.tokens.tokenFile ?? 'the token set'} first; do not hardcode it.`;
  }

  const px = toPxLocal(v);
  if (px !== null) {
    if (k.usesTailwind) {
      const steps = [0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96];
      let best = steps[0];
      for (const s of steps) if (Math.abs(s - px) < Math.abs(best - px)) best = s;
      const name = best % 4 === 0 ? String(best / 4) : { 1: 'px', 2: '0.5', 6: '1.5', 10: '2.5', 14: '3.5' }[best];
      return best === px
        ? `${v} sits on the Tailwind scale: step ${name}. Use the utility, not the raw value.`
        : `${v} is off-scale here. Nearest Tailwind step: ${name} (${best}px). If the design genuinely needs ${v}, that is a token, not a one-off.`;
    }
    const prior = k.spacingSeen.get(v);
    if (prior) return `${v} is already in use ${prior}x in this repo. Consistent, so use it, but know it lives off any scale.`;
    if (!k.spacingSeen.size) return `This repo has no spacing values on record to compare ${v} against. Whatever you pick becomes a precedent; pick something divisible by 4.`;
    const near = [...k.spacingSeen.entries()].map(([val, count]) => ({ val, count, px: toPxLocal(val) }))
      .filter((x) => x.px !== null).sort((a, b) => Math.abs(a.px - px) - Math.abs(b.px - px))[0];
    return near
      ? `${v} would be a new one-off. Closest value this repo already uses: ${near.val} (${near.count}x).`
      : `${v} would be a new one-off spacing value in this repo.`;
  }

  return `I can look up colours (#hex, rgb/hsl/oklch) and lengths (px/rem/em). "${v}" is neither.`;
}

function normalizeShortHex(h) {
  if (/^#[0-9a-f]{3,4}$/.test(h)) return '#' + [...h.slice(1)].map((c) => c + c).join('');
  return h;
}
function toPxLocal(len) {
  const m = /^(-?\d*\.?\d+)(px|rem|em)$/.exec(len);
  if (!m) return null;
  return m[2] === 'px' ? parseFloat(m[1]) : parseFloat(m[1]) * 16;
}

// ---------- roast_validate ----------
export function validate(k, { code, file = null }) {
  if (!code?.trim()) return 'Send the code you are about to save (and ideally its file path).';
  const { findings } = validateContent({ text: code, file }, k);
  if (!findings.length) return cleanResultText();
  const L = [`${findings.length} finding${findings.length === 1 ? '' : 's'}:`];
  for (const f of findings.slice(0, 12)) {
    L.push(`${f.severity === 'violation' ? '✕' : '⚠'} L${f.line} ${f.message}${f.fix ? `\n   Fix: ${f.fix}` : ''}`);
  }
  if (findings.length > 12) L.push(`(+${findings.length - 12} more of the same kinds)`);
  L.push(`Checked: ${CHECKS.join(', ')}.`);
  return L.join('\n');
}

// ---------- roast_review ----------
export function review(k) { return reviewData(k).text; }

/** Same review, with the finding count for callers that need an exit code. */
export function reviewData(k) {
  let names, gitRoot, realRoot;
  try {
    // git reports paths relative to ITS root, which may sit above the scanned
    // root (server pointed at a package inside a monorepo) — resolve against
    // the toplevel, review only what lives under the scanned root
    gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: k.root, encoding: 'utf8' }).trim();
    // git prints resolved paths; the scan root may arrive through a symlink
    // (macOS /var → /private/var) — compare like with like
    realRoot = realpathSync(k.root);
    const tracked = execFileSync('git', ['diff', 'HEAD', '--name-only'], { cwd: k.root, encoding: 'utf8' });
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--full-name'], { cwd: k.root, encoding: 'utf8' });
    names = [...new Set([...tracked.split('\n'), ...untracked.split('\n')].map((s) => s.trim()).filter(Boolean))]
      .filter((f) => join(gitRoot, f).startsWith(realRoot));
  } catch {
    return { text: 'Not a git repository (or git is unavailable), so there is no diff to review. Use roast_validate with the code instead.', total: 0 };
  }
  const RELEVANT = /\.(tsx|jsx|ts|js|vue|svelte|css|scss|sass|less)$/i;
  const changed = names.filter((f) => RELEVANT.test(f));
  if (!changed.length) return { text: 'No changed UI or style files in the working tree. Nothing to review.', total: 0 };

  const perFile = [];
  let total = 0;
  for (const f of changed.slice(0, 40)) {
    let text;
    try { text = readFileSync(join(gitRoot, f), 'utf8'); } catch { continue; }
    // knowledge paths are scanned-root-relative; git paths are toplevel-relative
    const { findings } = validateContent({ text, file: relative(realRoot, join(gitRoot, f)) }, k);
    if (findings.length) { perFile.push({ f, findings }); total += findings.length; }
  }
  if (!total) {
    return { text: `Reviewed ${changed.length} changed file${changed.length === 1 ? '' : 's'}. ${cleanResultText()}`, total: 0 };
  }
  const L = [`DESIGN SYSTEM REVIEW · ${changed.length} changed file${changed.length === 1 ? '' : 's'}, ${total} finding${total === 1 ? '' : 's'}:`];
  for (const { f, findings } of perFile.slice(0, 10)) {
    L.push(`${f}:`);
    for (const x of findings.slice(0, 6)) L.push(`  ✕ L${x.line} ${x.message}${x.fix ? `\n     Fix: ${x.fix}` : ''}`);
    if (findings.length > 6) L.push(`  (+${findings.length - 6} more in this file)`);
  }
  if (perFile.length > 10) L.push(`(+${perFile.length - 10} more files with findings)`);
  L.push(`Checked: ${CHECKS.join(', ')}. Fix the findings before finishing; rerun roast_review to confirm.`);
  return { text: L.join('\n'), total };
}

export { approxTokens };
