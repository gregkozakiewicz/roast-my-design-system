/**
 * Rule staleness — checks the agent rules a repo already has against what the
 * scan just measured. Rules are written once and rot silently: a rule naming
 * Button.tsx keeps mistraining every agent long after ButtonV2 took over.
 * Deterministic on purpose: only claims we can verify are flagged —
 * referenced paths that no longer exist, referenced components that no file
 * defines, and referenced components that nothing imports anymore.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const AGENT_FILES = ['CLAUDE.md', 'AGENTS.md', '.cursorrules', '.windsurfrules', '.github/copilot-instructions.md', 'design-system-rules.md'];
const MAX_BYTES = 200_000;
const MAX_FINDINGS = 10;

// path-like token with a source extension; must contain a slash so bare
// filenames in prose ("edit package.json") don't fire
const PATH_RE = /(?:^|[\s`("'])([\w@.-]+(?:\/[\w@.-]+)+\.(?:tsx|jsx|ts|js|mjs|cjs|css|scss|sass|less|vue|svelte))(?=[\s`)"',.:]|$)/g;
// component reference: <Name ...> or `Name` in backticks, PascalCase, 4+ chars
const TAG_RE = /<([A-Z][A-Za-z0-9]{3,})[\s/>]/g;
const TICK_RE = /`<?([A-Z][A-Za-z0-9]{3,})>?`/g;

// Our own generated rules deliberately name never-imported components as
// warnings, so re-reading those mentions as "named canonical" would make
// --apply trigger the staleness alarm on itself. In our content, only path
// claims are checked (they rot for real); component-usage claims are not.
const OURS_RE = /roast-my-design-system/i;
const BLOCK_RE = /<!-- roast-my-design-system:rules:begin[\s\S]*?roast-my-design-system:rules:end -->/g;

function ruleTexts(root) {
  const texts = [];
  // `text` keeps everything (paths are checked everywhere); `handWritten` is
  // the file minus our injected block, and component checks run only on it.
  const push = (file, text) => {
    const handWritten = text.replace(BLOCK_RE, '');
    texts.push({ file, text, handWritten, ours: OURS_RE.test(handWritten) });
  };
  for (const f of AGENT_FILES) {
    const p = join(root, f);
    try { if (statSync(p).isFile() && statSync(p).size <= MAX_BYTES) push(f, readFileSync(p, 'utf8')); } catch { /* absent */ }
  }
  const dir = join(root, '.cursor', 'rules');
  try {
    for (const e of readdirSync(dir)) {
      if (!/\.(md|mdc)$/.test(e)) continue;
      const p = join(dir, e);
      if (statSync(p).size <= MAX_BYTES) push(`.cursor/rules/${e}`, readFileSync(p, 'utf8'));
    }
  } catch { /* no cursor rules dir */ }
  return texts;
}

/**
 * Returns [{ file, ref, kind: 'path'|'component', problem: 'missing'|'unused' }]
 * capped at MAX_FINDINGS across all rule files.
 */
// Placeholder segments from pattern docs ("packages/features/myfeature/…",
// "path/to/test.ts") are examples, not claims. Build outputs exist only after
// a build, so a fresh clone can't judge them.
const PLACEHOLDER_SEG = /^(path|to|my[\w.-]+|your[\w.-]*|example[\w.-]*|some[\w.-]+|foo|bar|baz)$/i;
// test/story files are excluded from the walk, so a package-relative
// reference to one can never be verified; stay silent rather than guess
const UNVERIFIABLE_RE = /\.(test|spec|stories|story|cy)\.[cm]?[jt]sx?$/;
const BUILD_DIRS = new Set(['dist', 'build', 'out', '.next', 'node_modules', 'coverage']);

/**
 * @param neverImportedNames names from the hardened never-imported detector;
 *   component claims are only flagged when that detector agrees, so routing
 *   and dynamic-import usage never produces a false "nothing imports it".
 * @param fileSuffixes every walked file path; a rule path that does not exist
 *   at the root but matches the tail of a real file is written relative to a
 *   package dir, not stale.
 */
export function ruleStaleness(root, components, neverImportedNames = new Set(), fileSuffixes = []) {
  const byName = new Map();
  for (const c of components) {
    const prev = byName.get(c.name);
    if (!prev || c.usageCount > prev.usageCount) byName.set(c.name, c);
  }
  const findings = [];
  const seen = new Set();
  const add = (file, ref, kind, problem) => {
    const key = `${ref}|${problem}`;
    if (seen.has(key) || findings.length >= MAX_FINDINGS) return;
    seen.add(key);
    findings.push({ file, ref, kind, problem });
  };
  const isPlaceholder = (ref) => ref.split('/').some((seg) => PLACEHOLDER_SEG.test(seg));
  const existsAsSuffix = (ref) => fileSuffixes.some((f) => f === ref || f.endsWith(`/${ref}`));

  for (const { file, text, handWritten, ours } of ruleTexts(root)) {
    for (const m of text.matchAll(PATH_RE)) {
      const ref = m[1].replace(/^\.\//, '');
      if (isPlaceholder(ref)) continue;
      if (BUILD_DIRS.has(ref.split('/')[0])) continue;
      if (existsSync(join(root, ref))) continue;
      if (existsAsSuffix(ref)) continue;
      // a short test-file ref is almost surely package-relative and unverifiable;
      // a deep root-relative one was checked by existsSync above and is real drift
      if (UNVERIFIABLE_RE.test(ref) && ref.split('/').length < 4) continue;
      add(file, ref, 'path', 'missing');
    }
    if (ours) continue; // fully generated file: paths checked above, component claims are ours to regenerate, not to second-guess
    const compRefs = new Set();
    for (const m of handWritten.matchAll(TAG_RE)) compRefs.add(m[1]);
    for (const m of handWritten.matchAll(TICK_RE)) compRefs.add(m[1]);
    for (const name of compRefs) {
      const def = byName.get(name);
      if (!def) continue; // never claim a component is missing from a name we can't resolve: could be a library import
      if (!def.isPage && def.usageCount === 0 && neverImportedNames.has(name)) add(file, name, 'component', 'unused');
    }
  }
  return findings;
}
