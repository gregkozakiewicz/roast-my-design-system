#!/usr/bin/env node
/**
 * Snapshot test suite for the scan engine. Five fixture repos, frozen expected
 * outputs. Any engine change that moves a score, a tile, a verdict, a rule or
 * an exclusion shows up here as a diff before it can ship.
 *
 *   node test/run.mjs            run all checks, exit 1 on any mismatch
 *   node test/run.mjs --update   regenerate the expected files (review the
 *                                diff before committing: expected files are
 *                                the contract)
 *
 * Runs against whichever engine sits next to it: proffer-2's src/ (the source
 * of truth) or the roaster repo's vendored scripts/ (what actually ships).
 * The same suite must pass in both places.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = existsSync(join(HERE, '../src/harvest/index.mjs'))
  ? resolve(HERE, '../src')
  : resolve(HERE, '../skills/roast-my-design-system/scripts');
const FIXTURES = join(HERE, 'fixtures');
const EXPECTED = join(HERE, 'expected');
const UPDATE = process.argv.includes('--update');

const { rulesMarkdown } = await import(pathToFileURL(join(ENGINE, 'rules/build.mjs')).href);

let pass = 0, fail = 0;
const ok = (name) => { pass++; console.log(`  ✓ ${name}`); };
const bad = (name, detail) => { fail++; console.log(`  ✗ ${name}\n    ${detail}`); };

function runEngine(script, args) {
  const r = spawnSync(process.execPath, [join(ENGINE, script), ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${script} exited ${r.status}: ${r.stderr}`);
}

// Version and machine paths change between runs and releases; the contract
// is everything else.
const stripVersion = (s) => s.replace(/ver\. \d+\.\d+\.\d+/g, 'ver. X').replace(/\d+\.\d+\.\d+/g, 'X');
function normalizeSummary(s) {
  const { version, report, ...rest } = s;
  return rest;
}
function normalizeHarvest(h) {
  const c = JSON.parse(JSON.stringify(h));
  c.repo = null; c.harvestedAt = null; c.tookMs = null;
  return c;
}

function compare(name, actual, expectedFile) {
  const p = join(EXPECTED, expectedFile);
  const text = typeof actual === 'string' ? actual : JSON.stringify(actual, null, 2);
  if (UPDATE) { writeFileSync(p, text); ok(`${name} (expected updated)`); return; }
  if (!existsSync(p)) { bad(name, `missing expected file ${expectedFile}; run with --update`); return; }
  const want = readFileSync(p, 'utf8');
  if (text === want) { ok(name); return; }
  const a = text.split('\n'), b = want.split('\n');
  const at = a.findIndex((l, i) => l !== b[i]);
  bad(name, `first diff at line ${at + 1}:\n    want: ${b[at] ?? '(end)'}\n    got:  ${a[at] ?? '(end)'}`);
}

const tmp = mkdtempSync(join(tmpdir(), 'roast-test-'));
console.log(`engine: ${ENGINE}\n`);

for (const fixture of readdirSync(FIXTURES).sort()) {
  console.log(`${fixture}:`);
  const root = join(FIXTURES, fixture);
  const hPath = join(tmp, `${fixture}.json`);
  const sPath = join(tmp, `${fixture}-s.json`);
  runEngine('harvest/index.mjs', [root, '--out', hPath]);
  runEngine('diagnose/index.mjs', [hPath, '--out', join(tmp, `${fixture}.html`), '--summary', sPath]);

  const h = JSON.parse(readFileSync(hPath, 'utf8'));
  const s = JSON.parse(readFileSync(sPath, 'utf8'));
  compare('summary snapshot', normalizeSummary(s), `${fixture}.summary.json`);
  compare('rules snapshot', stripVersion(rulesMarkdown(h).text), `${fixture}.rules.md`);
  compare('compact rules snapshot', stripVersion(rulesMarkdown(h, { compact: true }).text), `${fixture}.compact.md`);

  // The report must embed no machine paths (the examples leak of 2026-08-16)
  const html = readFileSync(join(tmp, `${fixture}.html`), 'utf8');
  if (html.includes(tmpdir()) || /\/Users\/[a-z]+\//.test(html.replace(new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ''))) {
    bad('report carries no machine paths', 'found a home or tmp path outside the scanned fixture root');
  } else ok('report carries no machine paths');
}

// Determinism: the same fixture scanned twice must produce identical data.
console.log('determinism:');
const d1 = join(tmp, 'det1.json'), d2 = join(tmp, 'det2.json');
runEngine('harvest/index.mjs', [join(FIXTURES, 'messy'), '--out', d1]);
runEngine('harvest/index.mjs', [join(FIXTURES, 'messy'), '--out', d2]);
const same = JSON.stringify(normalizeHarvest(JSON.parse(readFileSync(d1, 'utf8'))))
  === JSON.stringify(normalizeHarvest(JSON.parse(readFileSync(d2, 'utf8'))));
same ? ok('two harvests of messy are identical') : bad('two harvests of messy are identical', 'outputs differ');

// End-to-end through the npx wrapper, when it exists next to this engine
// (roaster repo layout only; proffer-2 has no bin).
const bin = resolve(ENGINE, '../../../bin/roast.mjs');
if (existsSync(bin)) {
  console.log('npx wrapper:');
  const r = spawnSync(process.execPath, [bin, join(FIXTURES, 'messy'), '--json', '--out', join(tmp, 'e2e.html')], { encoding: 'utf8' });
  try {
    const j = JSON.parse(r.stdout);
    const want = JSON.parse(readFileSync(join(EXPECTED, 'messy.summary.json'), 'utf8'));
    j.score === want.score ? ok(`--json e2e score ${j.score}`) : bad('--json e2e score', `want ${want.score}, got ${j.score}`);
  } catch (e) { bad('--json e2e', `stdout was not clean JSON: ${e.message}`); }
}

rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
