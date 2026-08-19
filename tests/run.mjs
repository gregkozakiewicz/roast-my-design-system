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
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
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
// Scan dates change at UTC midnight; snapshots must not (caught 2026-08-18,
// the first suite run on a later UTC day than its expected files).
const stripDates = (s) => s.replace(/\d{4}-\d{2}-\d{2}/g, 'DATE');
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
  compare('rules snapshot', stripDates(stripVersion(rulesMarkdown(h).text)), `${fixture}.rules.md`);
  compare('compact rules snapshot', stripDates(stripVersion(rulesMarkdown(h, { compact: true }).text)), `${fixture}.compact.md`);

  // The report must embed no machine paths (the examples leak of 2026-08-16)
  const html = readFileSync(join(tmp, `${fixture}.html`), 'utf8');
  if (html.includes(tmpdir()) || /\/Users\/[a-z]+\//.test(html.replace(new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ''))) {
    bad('report carries no machine paths', 'found a home or tmp path outside the scanned fixture root');
  } else ok('report carries no machine paths');

  // SARIF: findings-as-code-scanning output, with the run's absolute fixture
  // root and version stripped so only the findings themselves are the contract.
  const sarifPath = join(tmp, `${fixture}.sarif`);
  runEngine('sarif/index.mjs', [hPath, '--out', sarifPath]);
  const sarif = readFileSync(sarifPath, 'utf8').split(root).join('FIXTURE');
  compare('sarif snapshot', stripVersion(sarif), `${fixture}.sarif.json`);
}

// ---------- messy-only deep checks ----------
console.log('messy extras:');
const mh = JSON.parse(readFileSync(join(tmp, 'messy.json'), 'utf8'));

// Stale-rule detection: the fixture's CLAUDE.md references a file that does
// not exist; the staleness engine must flag it, and nothing else.
compare('staleness snapshot', mh.staleRules ?? [], 'messy.stale.json');

// The roast card: pure SVG from the summary, dates and versions stripped.
const cardPath = join(tmp, 'messy-card.svg');
runEngine('card/index.mjs', [join(tmp, 'messy-s.json'), '--out', cardPath]);
compare('card snapshot', stripVersion(readFileSync(cardPath, 'utf8').replace(/\d{4}-\d{2}-\d{2}/g, 'DATE')), 'messy.card.svg');

// --apply injection: a fresh CLAUDE.md gets the marked block, and a second
// run replaces rather than duplicates it.
const applyDir = join(tmp, 'apply');
mkdirSync(applyDir, { recursive: true });
writeFileSync(join(applyDir, 'CLAUDE.md'), '# my own rules\nkeep me.\n');
runEngine('rules/apply.mjs', [join(tmp, 'messy.json'), '--target', applyDir]);
const once = readFileSync(join(applyDir, 'CLAUDE.md'), 'utf8');
runEngine('rules/apply.mjs', [join(tmp, 'messy.json'), '--target', applyDir]);
const twice = readFileSync(join(applyDir, 'CLAUDE.md'), 'utf8');
once === twice ? ok('apply is idempotent') : bad('apply is idempotent', 'second run changed the file');
compare('apply snapshot', stripVersion(once), 'messy.apply.md');

// ---------- MCP: the five tools, snapshotted per fixture ----------
// Dates stripped (scan stamp changes daily); the answers are the contract.
// The token budget is an ASSERTION, not an aspiration: get_context over
// budget fails the suite before it can ship.
console.log('mcp:');
const { loadKnowledge } = await import(pathToFileURL(join(ENGINE, 'mcp/knowledge.mjs')).href);
const mcpTools = await import(pathToFileURL(join(ENGINE, 'mcp/tools.mjs')).href);
const BAD_SNIPPET = `export function Button() {
  return <div style={{ color: '#3b81f5', margin: '27px' }} className="p-[11px] text-[13px]">x</div>;
}`;
for (const fixture of readdirSync(FIXTURES).sort()) {
  const k = loadKnowledge(join(FIXTURES, fixture));
  const sections = [
    '=== get_context ===', mcpTools.getContext(k, {}),
    '=== find_component button ===', mcpTools.findComponent(k, { query: 'button' }),
    '=== find_component date picker ===', mcpTools.findComponent(k, { query: 'date picker' }),
    '=== find_token #3b81f5 ===', mcpTools.findToken(k, { value: '#3b81f5' }),
    '=== find_token 13px ===', mcpTools.findToken(k, { value: '13px' }),
    '=== validate bad snippet ===', mcpTools.validate(k, { code: BAD_SNIPPET }),
    '=== validate clean snippet ===', mcpTools.validate(k, { code: 'export function Ok() { return <div className="p-4" /> }' }),
  ];
  compare(`${fixture} mcp snapshot`, stripDates(sections.join('\n')), `${fixture}.mcp.txt`);
  const budget = mcpTools.approxTokens(mcpTools.getContext(k, {}));
  budget <= 400 ? ok(`${fixture} get_context budget ${budget} ≤ 400 tokens`)
    : bad(`${fixture} get_context budget`, `${budget} tokens, budget is 400`);
}

// monorepo routing: a path inside a package must narrow the slice
const mk = loadKnowledge(join(FIXTURES, 'monorepo'));
compare('monorepo routed context', stripDates(mcpTools.getContext(mk, { path: 'packages/ui' })), 'monorepo.mcp-routed.txt');

// review needs a real git repo: copy messy, commit it clean, add one bad file
console.log('mcp review:');
const gitFix = join(tmp, 'review-git');
rmSync(gitFix, { recursive: true, force: true });
spawnSync('cp', ['-R', join(FIXTURES, 'messy'), gitFix]);
const git = (...a) => spawnSync('git', a, { cwd: gitFix, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
git('init', '-q'); git('add', '-A'); git('commit', '-qm', 'base');
writeFileSync(join(gitFix, 'components/NewThing.tsx'), BAD_SNIPPET);
const rk = loadKnowledge(gitFix);
const reviewText = mcpTools.review(rk);
// guard against the symlinked-tmpdir regression of 2026-08-17: a review that
// sees no changed files here is a broken review, not a clean one
reviewText.startsWith('DESIGN SYSTEM REVIEW') ? ok('review actually reviews')
  : bad('review actually reviews', `got: ${reviewText.split('\n')[0]}`);
compare('review snapshot', stripDates(reviewText), 'messy.review.txt');
const cleanReview = mcpTools.reviewData(loadKnowledge(join(FIXTURES, 'messy')));
cleanReview.total === 0 ? ok('review outside git degrades honestly')
  : bad('review outside git', `expected 0 findings, got ${cleanReview.total}`);

// the server end to end: initialize → tools/list → one call, over real stdio
console.log('mcp server:');
{
  const msgs = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'roast_find_token', arguments: { value: '#3b82f6' } } },
  ].map((m) => JSON.stringify(m)).join('\n') + '\n';
  const r = spawnSync(process.execPath, [join(ENGINE, 'mcp/server.mjs'), join(FIXTURES, 'messy')],
    { input: msgs, encoding: 'utf8', timeout: 30000 });
  try {
    const replies = r.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const init = replies.find((x) => x.id === 1), list = replies.find((x) => x.id === 2), call = replies.find((x) => x.id === 3);
    init?.result?.serverInfo?.name === 'roast-my-design-system' ? ok('server initialize') : bad('server initialize', JSON.stringify(init));
    list?.result?.tools?.length === 5 ? ok('server lists 5 tools') : bad('server lists 5 tools', `got ${list?.result?.tools?.length}`);
    call?.result?.content?.[0]?.text?.includes('IS a token') ? ok('server tool call answers') : bad('server tool call answers', JSON.stringify(call?.result));
  } catch (e) { bad('server protocol', e.message); }
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
