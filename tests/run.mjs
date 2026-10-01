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
 * Runs against the engine in skills/roast-my-design-system/scripts/, the one
 * copy that ships. (It still finds a sibling src/ if one exists, a leftover
 * from the days of two repos.)
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, rmSync, readdirSync, cpSync, renameSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Git hooks export GIT_DIR and friends; inherited, they point every git call
// in the temp fixtures at the wrong repository. Scrub them so the suite gives
// the same verdict from a pre-commit hook as from a plain terminal.
for (const v of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) delete process.env[v];

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
  // the colour-use pass times itself, like the harvest
  if (c.colourUse) c.colourUse.ms = null;
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

// ---------- unit layer ----------
// The golden files catch a moved number; they cannot say which colour matrix
// or which regex moved it. tests/unit/*.test.mjs checks the parts one value
// at a time with node:test, and its pass/fail lands here as one line so the
// publish gate stays a single command.
console.log('unit:');
{
  const unitFiles = readdirSync(join(HERE, 'unit')).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => join(HERE, 'unit', f));
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...unitFiles], { encoding: 'utf8' });
  const count = (label) => parseInt(r.stdout.match(new RegExp(`^# ${label} (\\d+)`, 'm'))?.[1] ?? '0', 10);
  const passed = count('pass'), failed = count('fail');
  if (r.status === 0 && failed === 0 && passed > 0) ok(`${passed} unit checks (tests/unit)`);
  else bad(`unit checks: ${failed} failed of ${passed + failed}`, (r.stdout.split('\n').filter((l) => /^\s*not ok|^\s+(message|error|expected|actual):|^\s+at /.test(l)).slice(0, 40).join('\n    ') || r.stderr.trim().slice(0, 2000)));
}

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
compare('apply snapshot', stripDates(stripVersion(once)), 'messy.apply.md');

// ---------- trapped-only: the agent traps and their cap ----------
// The trapped fixture is guilty of all six trap conditions at once. The
// report must show exactly three boxes, in severity order; the harvest must
// prove each hidden trap's condition was genuinely met, so we know the cap
// (not a broken threshold) is what hid it. Before this fixture existed, no
// fixture tripped a single trap and the traps shipped unphotographed.
console.log('traps:');
{
  const th = JSON.parse(readFileSync(join(tmp, 'trapped.json'), 'utf8'));
  const tHtml = readFileSync(join(tmp, 'trapped.html'), 'utf8');
  const shown = [...tHtml.matchAll(/Agent trap\.<\/b> ([^<]+)/g)].map((m) => m[1]);
  shown.length === 3 ? ok('trap cap holds at three') : bad('trap cap holds at three', `got ${shown.length}: ${shown.join(' | ')}`);
  const order = ['implementations', 'appears', 'pairs of colours'];
  order.every((w, i) => shown[i]?.includes(w)) ? ok('traps render in severity order')
    : bad('traps render in severity order', shown.join(' | '));
  const { nearColorPairs } = await import(pathToFileURL(join(ENGINE, 'lib/nearpairs.mjs')).href);
  const { neverImportedComponents } = await import(pathToFileURL(join(ENGINE, 'lib/neverimported.mjs')).href);
  const hardDupes = (th.duplicates.exactDuplicates ?? []).filter((d) => !d.wrapped).length;
  const topSpacing = Math.max(0, ...(th.tokens.spacing ?? []).map((s) => s.count));
  const pairs = nearColorPairs(th.tokens.colors ?? []).length;
  const conditions = [
    ['duplicates trap condition met', hardDupes >= 2, `${hardDupes} hard duplicates, need 2`],
    ['spacing trap condition met', topSpacing >= 15, `top value ×${topSpacing}, need 15`],
    ['colour twins trap condition met', pairs >= 6, `${pairs} near pairs, need 6`],
    ['inline styles trap condition met', (th.tokens.inlineStyles?.count ?? 0) >= 50, `${th.tokens.inlineStyles?.count} blocks, need 50`],
    ['!important trap condition met', (th.tokens.important?.count ?? 0) >= 20, `${th.tokens.important?.count} declarations, need 20`],
    ['orphans trap condition met', neverImportedComponents(th.components, th.profile?.uiDir).length >= 10, 'need 10 never-imported in the DS dir'],
  ];
  for (const [name, met, detail] of conditions) met ? ok(name) : bad(name, detail);
}

// ---------- adoption map (5.5.0): drawn on trapped, dated from git ----------
// The fixtures sit inside this repo's own git history, so orphan dates are
// exercised on every run: real `git log` calls, real YYYY-MM-DD receipts.
console.log('adoption map:');
{
  const html = readFileSync(join(tmp, 'trapped.html'), 'utf8');
  // Small systems get no map on purpose: a treemap of four tiles says
  // nothing the table does not (Greg's call, 2026-08-29).
  !html.includes('class="amap"') ? ok('small system draws no map')
    : bad('small system draws no map', 'trapped has 5 adopted components yet a map rendered');
  /untouched since \d{4}-\d{2}-\d{2}/.test(html) ? ok('orphan dates render from git')
    : bad('orphan dates render from git', 'no "untouched since" receipt in trapped report');
  // The map itself, tested on a synthesized larger system: trapped's harvest
  // with ten well-used components patched in, run through the real diagnose.
  const big = JSON.parse(readFileSync(join(tmp, 'trapped.json'), 'utf8'));
  for (let i = 0; i < 10; i++) big.components.push({
    name: `Widget${i}`, file: `components/Widget${i}.jsx`, isPage: false,
    variants: {}, propsHint: null, usageCount: 40 - i * 3, usedIn: ['app/Page0.jsx'],
  });
  const bigPath = join(tmp, 'mapdemo.json');
  writeFileSync(bigPath, JSON.stringify(big));
  runEngine('diagnose/index.mjs', [bigPath, '--out', join(tmp, 'mapdemo.html')]);
  const mapHtml = readFileSync(join(tmp, 'mapdemo.html'), 'utf8');
  const tiles = (mapHtml.match(/class="atile"/g) ?? []).length;
  tiles >= 8 ? ok(`map draws ${tiles} tiles at scale`) : bad('map draws tiles at scale', `${tiles} tiles, need 8+`);
  mapHtml.includes('tile area is import count') ? ok('map section head names the encoding')
    : bad('map section head', 'missing "tile area is import count"');
  // Every tile carries a name (truncated when narrow), never an anonymous
  // square — Greg caught count-only tiles on the scale map (2026-09-02).
  const tileGroups = [...mapHtml.matchAll(/<g><rect[^>]*class="atile"[\s\S]*?<\/g>/g)];
  const unnamed = tileGroups.filter((g) => !g[0].includes('adot-n')).length;
  unnamed === 0 ? ok(`all ${tileGroups.length} map tiles carry a name`)
    : bad('map tile names', `${unnamed} anonymous tiles`);
}

// ---------- fix prompts: one copy button per Where-to-start move ----------
console.log('fix prompts:');
{
  const html = readFileSync(join(tmp, 'trapped.html'), 'utf8');
  const rows = (html.match(/class="ledger-row start-row"/g) ?? []).length;
  const btns = (html.match(/class="fixbtn" data-fix/g) ?? []).length;
  const prompts = (html.match(/class="fixprompt" hidden/g) ?? []).length;
  btns === rows && prompts === rows && rows > 0
    ? ok(`each of ${rows} moves carries a button and a prompt`)
    : bad('fix buttons match moves', `${rows} moves, ${btns} buttons, ${prompts} prompts`);
  html.includes('npx roast-my-design-system@latest') && html.includes('never blind-delete')
    ? ok('prompt carries the verify command and the calm rules')
    : bad('prompt content', 'missing verify command or fixing rules');
  // the invariant holds on every fixture: exactly one button per rendered move
  for (const fixture of readdirSync(FIXTURES).sort()) {
    const fh = readFileSync(join(tmp, `${fixture}.html`), 'utf8');
    const r = (fh.match(/class="ledger-row start-row"/g) ?? []).length;
    const b = (fh.match(/class="fixbtn" data-fix/g) ?? []).length;
    if (r !== b) bad(`buttons match moves on ${fixture}`, `${r} moves, ${b} buttons`);
  }
  ok('buttons equal moves on every fixture');
}

// ---------- the fixes: what the heading promises, the list delivers ----------
// "Three fixes to increase your score" stood over a list where 1 of the 3
// could, by 4 points (shadcn-admin, 2026-09-29). The line under the heading
// counts only the moves that pay, every move without points says why, and
// the heading drops the promise when nothing in the list can keep it.
console.log('fixes, the promise and the list:');
{
  const text = (h) => h.replace(/<[^>]+>/g, '');
  const section = (fixture) => {
    const html = readFileSync(join(tmp, `${fixture}.html`), 'utf8');
    const m = html.match(/<h2>(Fixes you can make right now[^<]*)<\/h2><p class="sub">([\s\S]*?)<\/p>/);
    const at = m ? html.indexOf(m[0]) : -1;
    const body = at > -1 ? html.slice(at, html.indexOf('</section>', at)) : '';
    return m ? {
      heading: m[1], line: text(m[2]),
      moves: (body.match(/class="ledger-row start-row"/g) ?? []).length,
      points: (body.match(/<span class="delta"[ >]/g) ?? []).length,
      targets: (body.match(/<span class="delta delta-target"/g) ?? []).length,
      reasons: [...body.matchAll(/<span class="delta delta-none">([^<]*)</g)].map((x) => x[1]),
      index: /<a href="#s-1"><i>01<\/i>What to fix<\/a>/.test(html),
    } : null;
  };

  const all = section('trapped');
  all.line === 'Three fixes could raise the design system health score from 40 to 70.' && all.points === 3 && all.reasons.length === 0
    ? ok('when every fix pays, the line says so and nothing is labelled')
    : bad('every fix pays', JSON.stringify(all));

  const some = section('shadcncustom');
  some.line === 'One of these two fixes could raise the design system health score from 82 to 91. The remaining one does not move the score.'
    && some.points === 1 && some.reasons.join() === 'not part of the score'
    ? ok('when 1 of 2 pays, the line counts 1 and the other says why')
    : bad('1 of 2 pays', JSON.stringify(some));

  // 13 stray colours among 360 token uses: a real fix, on a tile already green
  // (the agent rules file was the no-points fix here until it left the list,
  // 2026-09-30)
  const none = section('greenstrays');
  none.heading === 'Fixes you can make right now' && /^It does not move the score\./.test(none.line) && none.reasons.join() === 'already green'
    ? ok('when nothing pays, the heading drops the promise')
    : bad('nothing pays', JSON.stringify(none));

  // An unscored report promised "+10" and "raises the score, by 5" on
  // commerce, strapi and three more (2026-09-30).
  const unscored = section('unscored');
  unscored.heading === 'Fixes you can make right now' && /^This repo gets no score/.test(unscored.line)
    && unscored.points === 0 && unscored.targets === 0 && unscored.reasons.every((r) => r === 'no score here')
    ? ok('with no score, no fix claims points')
    : bad('unscored fixes', JSON.stringify(unscored));

  !/Write the agent rules file/.test(readFileSync(join(tmp, 'clean.html'), 'utf8'))
    ? ok('the agent rules file has its own section, never a place in the fixes')
    : bad('rules file in the fixes', 'clean lists "Write the agent rules file"');

  let wrong = 0;
  for (const fixture of readdirSync(FIXTURES).sort()) {
    const f = section(fixture);
    if (!f) continue;
    const labelled = f.points + f.targets + f.reasons.length;
    const promises = /increase the health score$/.test(f.heading);
    if (labelled !== f.moves) { wrong++; bad(`every move is labelled on ${fixture}`, `${f.moves} moves, ${labelled} labels`); }
    if (promises !== (f.points + f.targets > 0)) { wrong++; bad(`the heading matches the list on ${fixture}`, JSON.stringify(f)); }
    if (!f.index) { wrong++; bad(`the index names the section on ${fixture}`, 'no "What to fix" entry'); }
  }
  if (!wrong) ok('on every fixture each move is labelled, and the heading promises only what the list pays');
}

// ---------- shadcn tokens: bare HSL triplets are colours ----------
// ---------- both variant axes at once ----------
// A system with a theme switch AND a density switch states every token three
// times. Before 2026-09-11 that read as sprawl, so the systems doing the most
// work scored the worst. The fixture holds 4 real colours stated 10 times and
// a 2-step radius scale stated 6 times.
console.log('theme and density variants:');
{
  const th = JSON.parse(readFileSync(join(tmp, 'themed.json'), 'utf8'));
  const cols = th.tokens.colors.map((c) => c.value).sort();
  JSON.stringify(cols) === JSON.stringify(['#101010', '#2563eb', '#ff0055', '#ffffff'])
    ? ok('a dark theme restating every colour adds none of them')
    : bad('theme variants', `got ${cols.join(', ')}`);

  const radii = th.tokens.radii.map((r) => r.value).sort();
  JSON.stringify(radii) === JSON.stringify(['3px'])
    ? ok('two density variants of a radius scale add no radii; the stray still counts')
    : bad('density variants', `got ${radii.join(', ')}`);

  th.tokens.fontSizes.length === 0
    ? ok('font-size: var(--x) and inherit are discipline, not values')
    : bad('token refs', `got ${th.tokens.fontSizes.map((f) => f.value).join(', ')}`);

  // Counting and checking need opposite answers about a dark theme. The
  // report counts the base statement only; a guard must see every named
  // colour or it tells someone in a dark block to use the light twin.
  const named = [...(th.tokens.tokenColors ?? [])].sort();
  JSON.stringify(named) === JSON.stringify(['#101010', '#2563eb', '#60a5fa', '#f5f5f5', '#ffffff'])
    ? ok('a checker still sees every named colour, dark theme included')
    : bad('guard palette', `got ${named.join(', ')}`);

  (th.tokens.tokenCollisions ?? []).length === 0
    ? ok('a single-package repo is never accused of a collision')
    : bad('collision false positive', 'variants read as disagreement');
}

// ---------- token collisions: one name, two colours, two packages ----------
// Every guard here was bought with a false positive from the 19-repo probe
// (2026-09-11). The check is meant to be rare: it fires 8 times in 9,229
// definitions, so anything that makes it chatty is a regression.
console.log('token collisions:');
{
  const { tokenCollisions } = await import(pathToFileURL(join(ENGINE, 'harvest/collisions.mjs')).href);
  const { canonical } = await import(pathToFileURL(join(ENGINE, 'lib/color.mjs')).href);
  const ws = (dir) => dir.startsWith('packages/') || dir.startsWith('apps/');
  const D = (pkg, name, value) => ({ pkg, name, value, canon: canonical(value) });
  // A shared vocabulary the pair mostly agrees on, so a disagreement means something.
  const agree = (pkg) => ['a', 'b', 'c', 'd', 'e'].map((k, i) => D(pkg, `t${k}`, `#00000${i}`));
  const run = (defs, matcher = ws) => tokenCollisions(defs, matcher);
  const names = (r) => r.map((x) => x.name).sort().join(',');

  const base = [...agree('packages/x'), ...agree('apps/y')];
  names(run([...base, D('packages/x', 'brand', '#ff0000'), D('apps/y', 'brand', '#00ff00')])) === 'brand'
    ? ok('two aligned packages disagreeing on one name is a collision')
    : bad('collision missed', 'aligned pair, clear disagreement');

  run([...base, D('packages/x', 'brand', '#111'), D('apps/y', 'brand', '#111111')]).length === 0
    ? ok('#111 and #111111 are one colour, not a collision')
    : bad('notation false positive', 'shorthand hex compared as a string');

  run([...base, D('packages/x', 'brand', 'hsla(0, 0%, 100%, 1)'), D('apps/y', 'brand', '#fff')]).length === 0
    ? ok('hsla(0,0%,100%,1) and #fff are one colour')
    : bad('notation false positive', 'hsla vs hex compared as a string');

  run([...base, D('packages/x', 'brand', '#ff0000'), D('templates/z', 'brand', '#00ff00')]).length === 0
    ? ok('a package outside the declared workspaces is not the system')
    : bad('workspace guard', "shadcn's templates/ counted as the system");

  run([D('packages/x', 'brand', '#ff0000'), D('packages/x', 'brand', '#00ff00')]).length === 0
    ? ok('one package restating a name is a theme variant, not a collision')
    : bad('variant guard', 'dark mode read as disagreement');

  // supabase carries two unrelated shadcn palettes in two apps; they overlap
  // on names and agree on almost none of them. That is two products.
  const themeA = ['bg', 'fg', 'muted', 'accent', 'border', 'ring'].map((k, i) => D('apps/one', k, `#1000${i}${i}`));
  const themeB = ['bg', 'fg', 'muted', 'accent', 'border', 'ring'].map((k, i) => D('apps/two', k, `#9000${i}${i}`));
  run([...themeA, ...themeB]).length === 0
    ? ok('two packages that agree on nothing are two themes, not a collision')
    : bad('alignment guard', 'independent palettes reported as collisions');

  run([...base, D('packages/x', 'brand', 'var(--other)'), D('apps/y', 'brand', '#00ff00')]).length === 0
    ? ok('a var() reference is never one side of a collision')
    : bad('var guard', 'reference compared as a literal');

  run([...base, D('packages/x', 'brand', '#ff0000'), D('apps/y', 'brand', '#00ff00')], null).length === 0
    ? ok('a repo with no declared workspaces is never accused')
    : bad('single package', 'collision reported without workspaces');

  const three = run([...base, ...agree('apps/z'),
    D('packages/x', 'brand', '#ff0000'), D('apps/y', 'brand', '#ff0000'), D('apps/z', 'brand', '#00ff00')]);
  three.length === 1 && three[0].groups[0].pkgs.length === 2
    ? ok('three packages, one dissenter: the majority is named first')
    : bad('grouping', JSON.stringify(three));
}

// Born on shadcn/taxonomy (2026-09-06): a textbook shadcn repo on Tailwind v3
// scanned as "2 colours, none defined as CSS variables" because its tokens are
// bare HSL channels. The fixture holds the whole convention: triplets in two
// themes, hsl(var()) wrappers in the config, one bracket-class stray that is a
// token's twin, and an OG-image route whose artwork colours must not count.
console.log('shadcn tokens:');
{
  const { nearColorPairs } = await import(pathToFileURL(join(ENGINE, 'lib/nearpairs.mjs')).href);
  const sh = JSON.parse(readFileSync(join(tmp, 'shadcnv3.json'), 'utf8'));
  const cols = sh.tokens.colors;
  const tokens = cols.filter((c) => c.isToken);
  // 7, not 14: the .dark block restates the same nine names, and since
  // 2026-09-11 only a token's first statement counts towards the palette.
  tokens.length === 7 && tokens.every((c) => c.value.startsWith('hsl(')) ? ok(`bare HSL triplets read as ${tokens.length} hsl() tokens`)
    : bad('triplet tokens', `${tokens.length} tokens, values: ${tokens.slice(0, 3).map((c) => c.value).join(', ')}`);
  !cols.some((c) => /var\(/.test(c.value)) ? ok('hsl(var(--x)) never becomes a colour') : bad('var ref leak', cols.filter((c) => /var\(/.test(c.value)).map((c) => c.value).join(', '));
  const strays = cols.filter((c) => !c.isToken).map((c) => c.value).sort();
  JSON.stringify(strays) === JSON.stringify(['#e11d48', '#f2f6fa']) ? ok('bracket-class colours are the only strays')
    : bad('strays', `got ${strays.join(', ')}, want #e11d48 + #f2f6fa`);
  !cols.some((c) => c.value === '#ff00ff' || c.value === '#00ffee') ? ok('OG-image artwork colours are not strays') : bad('og exemption', 'OG hexes counted');
  const pairs = nearColorPairs(cols);
  pairs.some((p) => [p.a.value, p.b.value].includes('#f2f6fa') && [p.a.value, p.b.value].includes('hsl(210 40% 96.1%)'))
    ? ok('a hex stray is found as the twin of an hsl token') : bad('cross-space twin', `pairs: ${pairs.map((p) => `${p.a.value}≈${p.b.value}`).join(' | ') || 'none'}`);
  const shHtml = readFileSync(join(tmp, 'shadcnv3.html'), 'utf8');
  !shHtml.includes('None of these are defined as CSS variables') ? ok('the "every single one is hardcoded" banner stays off') : bad('banner', 'fired on a tokenised repo');
  const shS = JSON.parse(readFileSync(join(tmp, 'shadcnv3-s.json'), 'utf8'));
  const greyTile = (shS.tiles ?? []).find((t) => /grey/.test(t.label));
  greyTile && Number(greyTile.value) >= 3 ? ok(`hsl greys are counted (${greyTile.value})`) : bad('hsl greys', `grey tile: ${greyTile?.value}`);

  // cssVariables: false — shadcn's utility-class mode has no colour tokens BY
  // DESIGN. The report must say so, never accuse it of hardcoding everything.
  const su = JSON.parse(readFileSync(join(tmp, 'shadcnutil.json'), 'utf8'));
  su.profile.designSystem?.kind === 'shadcn' && su.profile.designSystem.cssVariables === false
    ? ok('components.json cssVariables:false is read') : bad('cssVariables flag', JSON.stringify(su.profile.designSystem));
  const suHtml = readFileSync(join(tmp, 'shadcnutil.html'), 'utf8');
  suHtml.includes('shadcn/ui (utility classes, no CSS variables)') ? ok('header chip names the utility-class mode') : bad('utility chip', 'missing');
  !suHtml.includes('None of these are defined as CSS variables') && suHtml.includes('by design')
    ? ok('utility-class mode explained, not accused') : bad('utility-mode copy', 'banner fired or note missing');

  // The token file is where the palette is, not where the most --vars are.
  // jsoncrack (2026-09-06): the label went to the Chrome extension's CSS (2
  // definitions, 33 strays) while constants/theme.ts held 57 tokens.
  const jt = JSON.parse(readFileSync(join(tmp, 'jstheme.json'), 'utf8'));
  jt.tokens.tokenFile === 'src/theme.ts' ? ok('token file is the JS palette, not the --var stylesheet')
    : bad('token file choice', `got ${jt.tokens.tokenFile}`);
  const jtRules = rulesMarkdown(jt).text;
  jtRules.includes('src/theme.ts') && !jtRules.includes('extension.css') ? ok('rules name the real token source')
    : bad('rules token source', 'extension.css named or theme.ts missing');
}

// ---------- a vendored catalogue is stock, not debt ----------
// Sahaj Jain (who maintains tweakcn), 2026-09-09: "unused shadcn components
// shouldn't penalize your score but can be a neutral warning". People bring
// the whole catalogue in one go because adding it piecemeal is tedious, and an
// unused component is protective — the agent reaches for it instead of writing
// its own. A factory-fresh install scored 75 and was told to delete its own
// catalogue. Duplicates stay penalised: two of a thing is the real harm.
console.log('vendored catalogue:');
{
  const sh = JSON.parse(readFileSync(join(tmp, 'shadcnv3.json'), 'utf8'));
  const shS = JSON.parse(readFileSync(join(tmp, 'shadcnv3-s.json'), 'utf8'));
  sh.profile.vendoredUi === true ? ok('a shadcn ui folder is recognised as vendored') : bad('vendoredUi', 'not detected');
  const tile = (shS.tiles ?? []).find((t) => /never imported/.test(t.label));
  Number(tile?.value) >= 3 && tile?.health === 'info'
    ? ok(`catalogue stock counted (${tile.value}) but unscored`) : bad('catalogue tile', `${tile?.value} / ${tile?.health}`);
  !(shS.moves ?? []).some((m) => /nobody imports/.test(m.title))
    ? ok('no fix-it move for catalogue stock') : bad('catalogue move', 'still telling people to delete the catalogue');
  const shHtml = readFileSync(join(tmp, 'shadcnv3.html'), 'utf8');
  shHtml.includes('catalogue components not used yet') && shHtml.includes('takes nothing off the score')
    ? ok('the report explains stock instead of accusing') : bad('catalogue copy', 'missing');
  const shRules = rulesMarkdown(sh).text;
  shRules.includes('Reach for one of these before building your own') && !shRules.includes('flag it for deletion')
    ? ok('the rules point the agent at the catalogue, not at deleting it') : bad('catalogue rules', 'still says delete');
  // The rule catalogue always declares every rule id; what matters is results.
  const shSarif = JSON.parse(readFileSync(join(tmp, 'shadcnv3.sarif'), 'utf8'));
  !(shSarif.runs?.[0]?.results ?? []).some((r) => r.ruleId === 'never-imported-component')
    ? ok('code scanning raises nothing for catalogue stock') : bad('catalogue sarif', 'findings raised');

  // The other side of the line: a components/ui folder full of hand-written
  // components is NOT a catalogue, and abandoned code there is still a finding.
  const mz = JSON.parse(readFileSync(join(tmp, 'messy.json'), 'utf8'));
  const mzS = JSON.parse(readFileSync(join(tmp, 'messy-s.json'), 'utf8'));
  mz.profile.vendoredUi === false ? ok('a hand-written ui folder is not a catalogue') : bad('false catalogue', 'messy waved through');
  const mzTile = (mzS.tiles ?? []).find((t) => /never imported/.test(t.label));
  mzTile && mzTile.health !== 'info' ? ok('abandoned components are still scored') : bad('messy tile', `${mzTile?.health}`);
}

// ---------- false positives the review must never raise ----------
// An order id read as a colour (2026-09-07): roast_validate told a demo repo
// that "#11004422 is new to this repo" — it had expanded the order id #1042
// as 4-digit RGBA. In a colour context all four lengths are real; loose in
// code they are identifiers far more often than colours.
console.log('false positives:');
{
  const { extractStyling } = await import(pathToFileURL(join(ENGINE, 'harvest/tokens.mjs')).href);
  const code = extractStyling('const orders=[{id:"#1042"},{id:"#1043"}]; const brand="#6d5bff"; const white="#fff";', { css: false });
  const vals = code.colors.map((c) => c.value).sort();
  JSON.stringify(vals) === JSON.stringify(['#6d5bff', '#ffffff'])
    ? ok('order ids in code are not colours, real hex still is') : bad('identifier hex', `got ${vals.join(', ')}`);
  extractStyling('<div style={{ color: "#1042" }} />', { css: false }).colors.length === 1
    ? ok('4-digit hex inside a style block is still a colour') : bad('style-block 4-digit', 'dropped');
  extractStyling('<div className="bg-[#1042]" />', { css: false }).colors.length === 1
    ? ok('4-digit hex in a bracket class is still a colour') : bad('bracket 4-digit', 'dropped');
  extractStyling('.a { background: #1042; }', { css: true }).colors.length === 1
    ? ok('4-digit hex in CSS is still a colour') : bad('css 4-digit', 'dropped');
}

// ---------- the five confirmed bugs of the 2026-09-11 review ----------
// Each reproduced before it was fixed; each has a line in the edgecases
// fixture so it cannot come back quietly.
console.log('confirmed bugs (2026-09-11):');
{
  const h = JSON.parse(readFileSync(join(tmp, 'edgecases.json'), 'utf8'));
  const colours = h.tokens.colors.map((c) => c.value);
  !colours.includes('#123456') && !colours.includes('#bad000')
    ? ok('a hex inside a CSS comment is not a colour') : bad('comment hex', `palette: ${colours.join(', ')}`);
  !colours.some((c) => c.startsWith('#ffaacc') || c === '#aadddd')
    ? ok('an id selector spelling hex is not a colour') : bad('selector hex', `palette: ${colours.join(', ')}`);
  colours.includes('#abcdef') && colours.includes('#ff8800') && colours.includes('#ff9900')
    ? ok('real declared colours still count, after a comment too') : bad('declared hex', `palette: ${colours.join(', ')}`);
  const arb = h.tokens.tailwind.arbitrary.map((a) => a.value).sort();
  const twSpacing = h.tokens.tailwind.spacing.map((v) => v.value);
  JSON.stringify(arb) === JSON.stringify(['[10px]', '[257px]', '[9px]'])
    ? ok('bracket spacing is not also an arbitrary value') : bad('arbitrary once', `arbitrary: ${arb.join(', ')}`);
  ['[13px]', '[17px]', '[4px]'].every((v) => twSpacing.includes(v))
    ? ok('bracket spacing still counts as off-scale spacing') : bad('bracket spacing', `spacing: ${twSpacing.join(', ')}`);
  h.tokens.inlineStyles.count === 1
    ? ok('opacity: .5 is a literal, so the block is a static inline style') : bad('inline .5', `count ${h.tokens.inlineStyles.count}`);
  const dupe = h.duplicates.exactDuplicates.find((d) => d.name === 'Button');
  dupe && dupe.files.some((f) => f.includes('Button('))
    ? ok('a bracket in a filename does not crash the duplicate check') : bad('filename regex', JSON.stringify(h.duplicates.exactDuplicates));
  // packages/app carried 0 greys and 9 grey strays at once: the stray count
  // was every hex stray, grey or not.
  const mono = JSON.parse(readFileSync(join(tmp, 'monorepo.json'), 'utf8'));
  const pkgs = (mono.packages ?? []).filter((p) => p.scored);
  pkgs.length && pkgs.every((p) => p.metrics.greyStrays <= p.metrics.greys)
    ? ok('a package never has more grey strays than greys') : bad('package greys', JSON.stringify(pkgs.map((p) => [p.dir, p.metrics.greys, p.metrics.greyStrays])));
}

// ---------- hardening from the 2026-09-11 security review ----------
// A scanned repo is not trusted: it can be a clone of anything.
console.log('hostile repo:');
{
  const h = JSON.parse(readFileSync(join(tmp, 'edgecases.json'), 'utf8'));
  const html = readFileSync(join(tmp, 'edgecases.html'), 'utf8');
  !h.tokens.colors.some((c) => c.value.includes('position'))
    ? ok('a colour that does not parse as a colour is not stored') : bad('unparsed colour stored', h.tokens.colors.map((c) => c.value).join(', '));
  !html.includes('position:fixed;inset:0')
    ? ok('the report paints no CSS a scanned stylesheet wrote') : bad('css injection', 'the hostile rgb() reached a style attribute');
  !h.files?.styles?.includes?.('styles/leak.css') && !JSON.stringify(h.tokens.fontFamilies ?? []).includes('leak.css')
    ? ok('a symlinked file is not read') : bad('symlink read', 'styles/leak.css (a link to package.json) was harvested');
  // One committed minified bundle is not design-system evidence, and reading
  // it whole is the cheapest way to make the scan fall over.
  const big = join(tmp, 'big-fixture');
  rmSync(big, { recursive: true, force: true });
  mkdirSync(join(big, 'src'), { recursive: true });
  writeFileSync(join(big, 'package.json'), JSON.stringify({ name: 'big', dependencies: { react: '18.0.0' } }));
  writeFileSync(join(big, 'src/App.tsx'), 'export function App() { return <div className="p-2">hi</div>; }\n');
  writeFileSync(join(big, 'src/bundle.css'), `.x{color:#0badf0}\n${'.y{margin:1px}\n'.repeat(160_000)}`);
  runEngine('harvest/index.mjs', [big, '--out', join(tmp, 'big.json')]);
  const bigH = JSON.parse(readFileSync(join(tmp, 'big.json'), 'utf8'));
  !bigH.tokens.colors.some((c) => c.value === '#0badf0')
    ? ok('a file over 2 MB is skipped, not swallowed') : bad('size cap', 'the 2 MB stylesheet was harvested');
}

// ---------- component stacks: web components read, unreadable declared ----------
// Born on telekom/scale (2026-09-01): 93 Stencil components scanned as one,
// and the report presented the blindness as discipline. Never again, twice
// over: the tag-registered world is read, and what cannot be read says so.
console.log('component stacks:');
{
  const wc = JSON.parse(readFileSync(join(tmp, 'webcomp.json'), 'utf8'));
  const btn = wc.components.find((c) => c.tag === 'acme-button');
  btn?.usageCount === 3 ? ok('stencil usage counted by kebab tag') : bad('stencil usage', `acme-button ×${btn?.usageCount}, want 3`);
  !btn?.usedIn.some((f) => f.includes('react-wrapper')) ? ok('generated wrappers add no phantom adoption')
    : bad('generated wrappers', 'react-wrapper counted as usage');
  wc.components.some((c) => c.tag === 'acme-icon') && wc.components.some((c) => c.tag === 'acme-chip')
    ? ok('lit and customElements.define detected') : bad('lit/define detection', 'missing');
  wc.profile.role === 'library' ? ok('published components package profiles as library') : bad('library role', wc.profile.role);
  const wcHtml = readFileSync(join(tmp, 'webcomp.html'), 'utf8');
  wcHtml.includes('The composition map') && wcHtml.includes('unused internally')
    && (wcHtml.includes('component library') || wcHtml.includes('custom design system'))
    ? ok('library language: composition, not adoption; stock, not corpses')
    : bad('library language', 'composition/unused-internally/ds-chip copy missing');
  wcHtml.includes('web components (Stencil)') ? ok('header names Stencil') : bad('header chip', 'no Stencil chip');
  wcHtml.includes('custom design system (--acme-*)') ? ok('namespace earns the design-system title')
    : bad('namespace chip', 'no custom design system (--acme-*) chip');
  wcHtml.includes('also present: --old-*') ? ok('secondary namespace reported as fact, never verdict')
    : bad('also-present chip', 'missing');
  const wcRules = rulesMarkdown(wc).text;
  wcRules.includes('--acme-*') && wcRules.includes('also') && wcRules.includes('--old-*')
    ? ok('rules teach the namespace and flag the second, verdict-free')
    : bad('rules namespace', 'missing --acme-*/--old-* guidance');

  const vue = JSON.parse(readFileSync(join(tmp, 'vueapp-s.json'), 'utf8'));
  vue.componentsMeasured === false ? ok('vue declared not measured') : bad('vue measurability', 'claimed measured');
  const vueHtml = readFileSync(join(tmp, 'vueapp.html'), 'utf8');
  vueHtml.includes('not measured: Vue single-file components') && vueHtml.includes('cannot read yet')
    ? ok('unmeasured tiles and ledger say why') : bad('not-measured copy', 'missing tile note or ledger sentence');
  !vueHtml.includes('class="amap"') ? ok('no map drawn from blindness') : bad('map on unmeasured repo', 'rendered');
}

// ---------- the colour-use bar (9.7.0): sized by use, three states ----------
// Born on formbricks: an app with a v4 theme of its own and none of shadcn's
// greys, a package with a v3 config and a sheet, palette classes everywhere.
// The bar is sized by use, the receipt counts the theme's names used as
// classes in the theme's own package, and the first move maps the palette
// onto the theme the app already has instead of telling it there is no theme.
//
// NOT APPROVED, ONLY FROZEN: the colouruse expected files carry lines that
// existing engine behaviour gets wrong on this shape, so a later --update
// must not read them as checked (roadmap: the rules builder and the live
// checks' context on a theme of the app's own beside a shadcn package):
//   - colouruse.rules.md and colouruse.compact.md, the first bullet under
//     "shadcn: the components and the theme": globals.css holds "background,
//     foreground, primary, muted, border and the rest, each with a light and
//     a dark value". It holds none of the greys and no light and dark pairs.
//   - the next bullet: globals.css "defines none of shadcn's colour
//     variables". It defines --color-primary and --color-primary-foreground.
//   - colouruse.mcp.txt, the TOKENS line: "18 colour tokens in
//     apps/web/modules/ui/globals.css. Use them as classes (bg-primary,
//     text-muted-foreground)". Only 8 of the 18 are in that file, and the
//     report's own move says text-muted-foreground leaves the text with no
//     colour there.
console.log('colour-use bar:');
{
  const html = readFileSync(join(tmp, 'colouruse.html'), 'utf8');
  html.includes('Sized by how often the code uses each colour') ? ok('the bar says it is sized by use')
    : bad('use bar subtitle', 'missing "Sized by how often the code uses each colour"');
  // class names matching the theme's names, across the repo, never one named
  // in a comment: 13 in 5 files, not 14 (survey-card.tsx matches the names
  // too, so the sentence says they match, not that they read this theme)
  html.includes('Its theme names 6 colours in apps/web/modules/ui/globals.css; class names matching them appear 13 times across 5 files.')
    ? ok("the shadcn receipt counts class names matching the theme's names") : bad('theme uses receipt', (html.match(/Its theme names[^<]*/) ?? ['missing'])[0]);
  html.includes('Map the palette onto the theme you already have') ? ok('a theme of its own without shadcn\'s greys is told to map the palette onto it')
    : bad('map move', 'missing "Map the palette onto the theme you already have"');
  const old = readFileSync(join(tmp, 'messy.html'), 'utf8');
  const cu = JSON.parse(readFileSync(join(tmp, 'colouruse.json'), 'utf8')).colourUse;
  cu.scope === 'own' && cu.doorFiles === 1 && cu.deadNames.top[0]?.[0] === 'ghost-ink'
    ? ok("shadcn's button is left out and a class with no colour behind it is dead") : bad('colouruse scope', JSON.stringify({ scope: cu.scope, doors: cu.doorFiles, dead: cu.deadNames }));
  !/Sized by how often each is used/.test(old) ? ok('no report says "each is used" any more') : bad('old subtitle', 'messy still says "Sized by how often each is used"');
  // the page itself: palette cells marked as palette, and the legend says so
  html.includes('<div class="uc pal"') ? ok('a palette class is drawn as a palette cell') : bad('palette cell', 'no class="uc pal" cell');
  html.includes('<span><i class="lg lg-pal"></i> Tailwind palette</span>') ? ok('the legend names the Tailwind palette') : bad('palette legend', 'no "Tailwind palette" legend entry');
  // a dark: override of white or black is a stray for its own reason
  html.includes('title="black ×1 as dark: overrides written by hand · most in apps/web/app/page.tsx"')
    ? ok('a dark: black is a stray with its own words') : bad('dark override tooltip', (html.match(/title="black ×[^"]*"/g) ?? ['none']).join(' | '));
  // white and black apart, and which dark: overrides the rule calls strays
  html.includes('Palette classes left out of the strays: plain white, apart from dark: backgrounds, text and borders;')
    ? ok('the sentence names plain white alone, and the dark: overrides the rule flags') : bad('white and black', (html.match(/Palette classes left out[^.]*/) ?? ['missing'])[0]);
  // a written value names a token only where the token holds it by day:
  // #e2e8f0 is --app-label's dark-mode value only
  html.includes('title="#e2e8f0 ×1 written by hand; a token already holds this value · most in apps/web/app/page.tsx"')
    ? ok('a written value is never named after a dark-mode-only token') : bad('written stray names', (html.match(/title="#e2e8f0[^"]*"/) ?? ['missing'])[0]);
  // at 375px the bar's cells must not widen the palette panels
  html.includes('.usage-bar .uc { min-width:2px; }') && html.includes('.palette-grid > * { min-width:0; }')
    ? ok('the bar fits a phone') : bad('phone width', 'missing .usage-bar .uc min-width:2px or .palette-grid > * min-width:0');
  // utility-class mode: the own theme's retuned neutrals reach it by name (rybbit)
  const util = JSON.parse(readFileSync(join(tmp, 'shadcnutiltheme.json'), 'utf8')).colourUse;
  util.segments.find((x) => x.names.includes('neutral-900'))?.state === 'token'
    ? ok("in utility-class mode a retuned neutral is the theme's, not the palette's") : bad('retuned in utility mode', JSON.stringify(util.segments.find((x) => x.names.includes('neutral-900'))));
}

// A repo written to the temp folder, harvested and diagnosed like a fixture;
// and a fixture's harvest, changed, drawn again. No expected files: each
// asserts one sentence.
function scanTemp(name, fileMap) {
  const root = join(tmp, `repo-${name}`);
  for (const [f, body] of Object.entries(fileMap)) { mkdirSync(dirname(join(root, f)), { recursive: true }); writeFileSync(join(root, f), body); }
  const hPath = join(tmp, `${name}.json`);
  runEngine('harvest/index.mjs', [root, '--out', hPath]);
  runEngine('diagnose/index.mjs', [hPath, '--out', join(tmp, `${name}.html`), '--summary', join(tmp, `${name}-s.json`)]);
  return { h: JSON.parse(readFileSync(hPath, 'utf8')), html: readFileSync(join(tmp, `${name}.html`), 'utf8') };
}
function redraw(name, from, change) {
  const h = JSON.parse(readFileSync(join(tmp, `${from}.json`), 'utf8'));
  change(h);
  const hPath = join(tmp, `${name}.json`);
  writeFileSync(hPath, JSON.stringify(h));
  runEngine('diagnose/index.mjs', [hPath, '--out', join(tmp, `${name}.html`), '--summary', join(tmp, `${name}-s.json`)]);
  return readFileSync(join(tmp, `${name}.html`), 'utf8');
}
const SHADCN_DEPS = '{"name":"app","private":true,"dependencies":{"react":"19.0.0","class-variance-authority":"0.7.0","@radix-ui/react-slot":"1.1.0"},"devDependencies":{"tailwindcss":"^4.1.0"}}';
const DOOR = (name) => `export function ${name}({ className }: { className?: string }) { return <div data-slot="${name.toLowerCase()}" className={className} />; }\n`;
const CATALOGUE10 = Object.fromEntries(['button', 'card', 'dialog', 'input', 'label', 'select', 'tabs', 'tooltip', 'badge', 'avatar']
  .map((c) => [`components/ui/${c}.tsx`, DOOR(c[0].toUpperCase() + c.slice(1))]));
const PALETTE_PAGE = (n) => `export default function Page() { return <main>${Array.from({ length: n }, (_, i) => `<p className="text-slate-${(i % 9 + 1) * 100} bg-white">x</p>`).join('')}</main>; }\n`;

console.log('colour-use bar, drawn:');
{
  // Folder names that are HTML: every path the bar prints is escaped. A
  // class named in a comment is not a use, so the receipt keeps 11.
  const hostile = join(tmp, 'repo-hostile');
  cpSync(join(FIXTURES, 'colouruse'), hostile, { recursive: true });
  renameSync(join(hostile, 'apps/web/app/settings'), join(hostile, 'apps/web/app/q"<s>&a'));
  renameSync(join(hostile, 'apps/web/modules'), join(hostile, 'apps/web/mo<b>d"&x'));
  const cj = join(hostile, 'apps/web/components.json');
  writeFileSync(cj, readFileSync(cj, 'utf8').replace('"modules/ui/globals.css"', '"mo<b>d\\"&x/ui/globals.css"'));
  const pg = join(hostile, 'apps/web/app/page.tsx');
  writeFileSync(pg, `${readFileSync(pg, 'utf8')}// once: text-brand bg-brand text-info\n/* and text-error */\n`);
  const hp = join(tmp, 'hostile.json');
  runEngine('harvest/index.mjs', [hostile, '--out', hp]);
  runEngine('diagnose/index.mjs', [hp, '--out', join(tmp, 'hostile.html'), '--summary', join(tmp, 'hostile-s.json')]);
  const page = readFileSync(join(tmp, 'hostile.html'), 'utf8');
  page.includes('Its theme names 6 colours in apps/web/mo&lt;b&gt;d&quot;&amp;x/ui/globals.css; class names matching them appear 13 times across 5 files.')
    ? ok('the receipt escapes its path and counts no class in a comment') : bad('hostile receipt', (page.match(/Its theme names[^<]*/) ?? ['missing'])[0]);
  page.includes('most in apps/web/app/q&quot;&lt;s&gt;&amp;a/page.tsx"') && !page.includes('q"<s>') && !page.includes('mo<b>d')
    ? ok('every tooltip escapes its path') : bad('hostile tooltips', 'a raw or missing path in the bar');

  // workout-cool: a shadcn repo whose rule has no theme to read, while the
  // off-theme colours tile counts its palette classes
  const wc = scanTemp('nosheet', {
    'package.json': SHADCN_DEPS,
    'tsconfig.json': '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["./*"]}}}',
    'components.json': '{"style":"new-york","tailwind":{"config":"","css":"app/css/globals.css","cssVariables":true},"aliases":{"components":"@/components","ui":"@/components/ui"}}',
    ...CATALOGUE10,
    // one stylesheet with a colour of its own, and no theme the rule can read
    'app/globals.css': '@import "tailwindcss";\n:root { --brand: #3355ff; }\n.note { color: #333333; }\n',
    'app/page.tsx': PALETTE_PAGE(12),
  });
  const wcLine = (wc.html.match(/<p class="sub use-line">([^<]*)/) ?? [])[1] ?? '';
  wc.h.profile.palette === null && (wc.h.profile.shadcn?.paint?.tin?.uses ?? 0) > 0
    && wcLine.includes("The palette rule found no theme here it can check these classes against, so the bar keeps them as Tailwind's palette. The off-theme colours tile still counts palette classes as off-theme.")
    && !wcLine.includes('none of them count as strays')
    ? ok('where the tile counts palette classes, the bar never says none of them count') : bad('rule off, tile on', wcLine || JSON.stringify(wc.h.profile.palette));

  // documenso and taxonomy: shadcn's rows in a stylesheet no config names
  const dm = scanTemp('contractonly', {
    'package.json': SHADCN_DEPS,
    ...CATALOGUE10,
    'styles/theme.css': ':root {\n  --background: 0 0% 100%;\n  --foreground: 222 47% 11%;\n  --primary: 222 47% 11%;\n  --primary-foreground: 210 40% 98%;\n  --muted: 210 40% 96%;\n  --muted-foreground: 215 16% 47%;\n  --border: 214 32% 91%;\n  --ring: 222 84% 5%;\n}\n.dark {\n  --background: 222 84% 5%;\n}\n',
    'app/page.tsx': PALETTE_PAGE(12),
  });
  dm.html.includes('Repaint the ') && !dm.html.includes('Decide what the product paints from')
    ? ok("shadcn's rows in an unconfigured stylesheet are a theme to repaint onto") : bad('contract-only move', (dm.html.match(/(Repaint|Decide|Map)[^<]{0,80}/) ?? ['no move'])[0]);

  // a theme read through Sass variables keeps the bar sized by written values
  const sass = scanTemp('sassy', {
    'package.json': '{"name":"sassy","private":true,"dependencies":{"react":"19.0.0","sass":"1.77.0"}}',
    'src/theme.scss': `$ink: #222222;\n$paper: #fafafa;\n${Array.from({ length: 12 }, (_, i) => `.c${i} { color: $ink; background: $paper; }`).join('\n')}\n`,
    'src/app.tsx': 'export const App = () => <p style={{ color: "#333333" }}>x</p>;\n',
  });
  sass.html.includes('go through Sass variables, which this bar cannot follow yet, so it is sized by written values instead.')
    && sass.html.includes('Sized by how often each value is written')
    ? ok('a Sass-read theme keeps the written bar and says why') : bad('fallback sentence', (sass.html.match(/<p class="sub use-line">[^<]*/) ?? ['missing'])[0]);

  // The receipt says nothing when its count is under half the bar's own
  // class uses: it read the wrong names (onlook, supabase)
  const quiet = redraw('fewuses', 'colouruse', (h) => { h.profile.shadcn.themeUses.uses = 2; });
  !quiet.includes('Its theme names') ? ok('a receipt the bar would contradict is left out') : bad('receipt guard', (quiet.match(/Its theme names[^<]*/) ?? [''])[0]);

  // The legend's "token" is a cell drawn with its colour: a bar of kit
  // reads alone (Unleash), its tail included, has none
  const kitOnly = redraw('kitonly', 'colouruse', (h) => {
    const cu = h.colourUse;
    cu.segments = cu.segments.map((x) => (x.state === 'token' ? { ...x, named: 'kit' } : x));
    cu.rest.token = { count: 3, weight: 3, named: { count: 3, weight: 3 } };
  });
  !kitOnly.includes('<i class="lg lg-tok"></i> token') && kitOnly.includes('<i class="lg lg-named"></i> named, colour not shown')
    ? ok('no "token" legend where every token cell is drawn without a swatch') : bad('legend split', (kitOnly.match(/<div class="legend">.{0,300}/) ?? [''])[0]);
  // the same bar with swatched colours folded into its tail keeps "token"
  const kitTail = redraw('kittail', 'kitonly', (h) => { h.colourUse.rest.token = { count: 3, weight: 3, named: { count: 1, weight: 1 } }; });
  kitTail.includes('<i class="lg lg-tok"></i> token') ? ok('a tail holding swatched tokens keeps the "token" legend') : bad('legend tail', (kitTail.match(/<div class="legend">.{0,300}/) ?? [''])[0]);
}

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
{
  // A whole bundle pasted into roast_validate stalled the server for seconds
  // in the CSS sniff; now it is refused with a number and a suggestion.
  const k = loadKnowledge(join(FIXTURES, 'clean'));
  const r = mcpTools.validate(k, { code: 'a'.repeat(250_000) });
  r?.invalidInput && /250k characters/.test(r.text)
    ? ok('validate refuses a 250k-character payload with a number') : bad('validate cap', JSON.stringify(r).slice(0, 120));
}
const mk = loadKnowledge(join(FIXTURES, 'monorepo'));
compare('monorepo routed context', stripDates(mcpTools.getContext(mk, { path: 'packages/ui' })), 'monorepo.mcp-routed.txt');

// review needs a real git repo: copy messy, commit it clean, add one bad file
console.log('mcp review:');
const gitFix = join(tmp, 'review-git');
rmSync(gitFix, { recursive: true, force: true });
spawnSync('cp', ['-R', join(FIXTURES, 'messy'), gitFix]);
const git = (...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: gitFix, encoding: 'utf8' });
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
// The review skill runs the standalone script (8.4.0): same text as the MCP
// tool, exit 1 on findings, --json for scripts.
{
  const script = join(ENGINE, 'review/index.mjs');
  const r = spawnSync(process.execPath, [script, gitFix], { encoding: 'utf8' });
  r.status === 1 && r.stdout.trim() === reviewText.trim() ? ok('review script prints the MCP review and exits 1 on findings')
    : bad('review script', `status ${r.status}; same text: ${r.stdout.trim() === reviewText.trim()}`);
  const j = spawnSync(process.execPath, [script, gitFix, '--json'], { encoding: 'utf8' });
  let parsed = null; try { parsed = JSON.parse(j.stdout); } catch { /* not json */ }
  parsed && parsed.findings > 0 && typeof parsed.text === 'string' ? ok('review script --json carries the count and the text')
    : bad('review script --json', j.stdout.slice(0, 120));
  const c = spawnSync(process.execPath, [script, join(FIXTURES, 'messy')], { encoding: 'utf8' });
  c.status === 0 ? ok('review script exits 0 with nothing to review') : bad('review script clean exit', `status ${c.status}`);
}

// ---------- the scales the engine used to ignore ----------
// The other half of the drift (2026-09-08): guard flagged a new radius, font
// size, shadow or typeface and the engine did not, so a change could come up
// clean locally and be stopped in CI by the same product.
console.log('declared scales:');
{
  const dk = loadKnowledge(join(FIXTURES, 'messy'));
  const strayCss = '.hero { border-radius: 12px; font-size: 13px; box-shadow: 0 4px 8px #000000; font-family: Roboto, sans-serif; }';
  const out = mcpTools.validate(dk, { code: strayCss });
  for (const [needle, label] of [
    ['border radius 12px', 'a new radius is flagged'],
    ['first font size', 'the first font size says there is nothing to compare it to'],
    ['shadow', 'a new shadow is flagged'],
    ['typeface Roboto', 'a new typeface is flagged'],
  ]) {
    out.includes(needle) ? ok(label) : bad(label, `missing "${needle}" in: ${out}`);
  }
  out.includes('7px') ? ok('the new radius names the nearest one the repo uses')
    : bad('radius advice', 'no nearest value named');
  out.includes('Georgia') && out.includes('Inter')
    ? ok('the typeface finding names what the system does declare') : bad('typeface advice', out);

  // values the repo already declares are consistency, not a sin
  const clean = mcpTools.validate(dk, { code: '.ok { border-radius: 7px; font-family: Inter; }' });
  clean.startsWith('No measured violations found')
    ? ok('a radius and a typeface the system already has stay silent') : bad('known values', clean);

  // and token use, resets and inheritance are never sins
  const disciplined = mcpTools.validate(dk, { code: '.ok { border-radius: var(--r); font-size: inherit; box-shadow: none; font-family: var(--font); }' });
  disciplined.startsWith('No measured violations found')
    ? ok('var(), inherit and none are disciplined, not mess') : bad('benign values', disciplined);

  // in code these live in class strings, where the arbitrary check already looks
  const inCode = mcpTools.validate(dk, { code: 'export const A = () => <div className="rounded-lg text-sm shadow-md" />;' });
  !inCode.includes('border radius') ? ok('utility classes are not read as raw declarations')
    : bad('code-mode scales', inCode);
}

// ---------- files no checker should judge ----------
// Found by comparing against guard-my-design-system (2026-09-08): guard
// exempted email, print and SVG artwork; the engine judged them anyway, so
// the same change got two different answers. A checker that cries wolf on
// email templates is a checker people switch off.
console.log('exemptions:');
{
  const ek = loadKnowledge(join(FIXTURES, 'messy'));
  const EMAIL = `export function Welcome() {
  return <table style={{ background: '#3b81f5', padding: '27px' }}><tr><td>hi</td></tr></table>;
}`;
  // an email shows it: here by the table attributes only an email carries
  // (9.2.3: a folder called email no longer makes a file one)
  const MAIL = `export function Welcome() {
  return <table cellPadding="0" style={{ background: '#3b81f5', padding: '27px' }}><tr><td>hi</td></tr></table>;
}`;
  const ICON = `export function Icon() {
  return <svg viewBox="0 0 16 16"><path fill="#3b81f5" d="M0 0h16v16H0z" /></svg>;
}`;
  const judged = mcpTools.validate(ek, { code: EMAIL, file: 'src/components/Welcome.tsx' });
  judged.includes('finding') ? ok('the same markup outside email is still judged')
    : bad('control case', `expected findings, got: ${judged.split('\n')[0]}`);

  for (const [file, code, label] of [
    ['src/email/Welcome.tsx', MAIL, 'email templates'],
    ['src/print/Invoice.tsx', EMAIL, 'print stylesheets'],
    ['src/components/Icon.tsx', ICON, 'SVG artwork'],
    ['app/global-error.tsx', EMAIL, 'the Next.js crash page'],
  ]) {
    const out = mcpTools.validate(ek, { code, file });
    out.startsWith('Not judged:') ? ok(`${label} are exempt, and say why`)
      : bad(`${label} exempt`, `got: ${out.split('\n')[0]}`);
  }

  // a screen about email is a screen: the path alone buys nothing
  const aboutEmail = mcpTools.validate(ek, { code: EMAIL, file: 'src/settings/EmailSettings.tsx' });
  !aboutEmail.startsWith('Not judged:') ? ok('a screen about email is judged like any screen')
    : bad('email-named screen', 'a settings screen walked free because its name says email');

  // the name alone must not buy the exemption
  const fakeBadge = mcpTools.validate(ek, { code: EMAIL, file: 'src/components/Badge.tsx' });
  !fakeBadge.startsWith('Not judged:') ? ok('an artwork name that draws no artwork earns nothing')
    : bad('badge exemption', 'plain styled UI walked free');

  // pictures drawn with code (2026-09-08): the report had exempted these
  // since 5.10, roast --check and the guard had not, so the same OG card was
  // clean in one door and full of strays in another
  const OG = `import { ImageResponse } from 'next/og';
export function GET() { return new ImageResponse(<div style={{ background: '#c0ffee', padding: '27px' }} />); }`;
  const SCENE = 'export const Board = () => <div style={{ background: "#c0ffee" }} />;';
  const DRAWING = `export function Scene() {
  return <svg>${'<path fill="#c0ffee" />'.repeat(15)}</svg>;
}`;
  for (const [file, code, label] of [
    ['app/api/og/route.tsx', SCENE, 'an OG route is exempt by its path'],
    ['src/cards/Share.tsx', OG, 'a satori or next/og surface is exempt by what it imports'],
    ['components/two-buttons/tailwind.tsx', `import { Button } from 'react-email';\n${SCENE}`, 'an email built with an email kit is exempt by what it imports'],
    ['src/renderers/Board.tsx', SCENE, 'a pixel renderer is exempt'],
    ['src/components/Anything.tsx', DRAWING, 'a file that is mostly drawing is exempt whatever it is called'],
    // teable's icon set names files for what they show (2026-09-30)
    ['packages/icons/src/components/ActionSendEmail.tsx', ICON, 'an icon in an icon folder is exempt whatever it is called'],
  ]) {
    const out = mcpTools.validate(ek, { code, file });
    out.startsWith('Not judged:') ? ok(label) : bad(label, `got: ${out.split('\n')[0]}`);
  }
  // the folder alone buys nothing: styled UI kept beside the icons is judged
  const iconFolderUi = mcpTools.validate(ek, { code: SCENE, file: 'src/icons/IconPicker.tsx' });
  !iconFolderUi.startsWith('Not judged:') ? ok('a component in an icon folder that draws nothing is judged')
    : bad('icon folder', 'plain styled UI walked free because it sits beside the icons');
  // a component with a little SVG in it is still a component
  const someSvg = mcpTools.validate(ek, {
    code: 'export const Row = () => <div style={{ color: "#c0ffee" }}><svg><path /></svg></div>;',
    file: 'src/components/Row.tsx',
  });
  !someSvg.startsWith('Not judged:') ? ok('a little SVG does not make a component into artwork')
    : bad('svg-heavy threshold', 'a two-tag component walked free');

  // and the review must skip them without calling the result clean
  mkdirSync(join(gitFix, 'components/email'), { recursive: true });
  writeFileSync(join(gitFix, 'components/email/Receipt.tsx'), MAIL);
  const exemptReview = mcpTools.reviewData(loadKnowledge(gitFix));
  !exemptReview.text.includes('Receipt.tsx') && exemptReview.text.includes('left unjudged')
    ? ok('review skips exempt files and admits it')
    : bad('review exemption', exemptReview.text.split('\n').pop());
}

// the server end to end: initialize → tools/list → one call, over real stdio
// ---------- the kits, through the MCP door ----------
// 8.0 taught the report to read MUI, Mantine, Chakra, Ant Design and a
// Tailwind theme; the MCP server was not taught the same and told an MUI
// repo it had no tokens (Greg caught it from the folder dates, 2026-09-18).
// Every profile the report reads, the server must read too.
console.log('kits in the mcp:');
{
  const { validateContent } = await import(pathToFileURL(join(ENGINE, 'mcp/engine.mjs')).href);
  const mk = loadKnowledge(join(FIXTURES, 'muikit'));
  const ctx = mcpTools.getContext(mk, {});
  ctx.includes('KIT: MUI') && ctx.includes('src/theme/theme.ts') ? ok('context names the kit and its theme file')
    : bad('kit context', ctx.split('\n')[1]);
  !ctx.includes('TOKENS: none defined') ? ok('a kit repo is never told it has no tokens') : bad('kit tokens', ctx.split('\n')[1]);
  const inTheme = mcpTools.findToken(mk, { value: '#667085' });
  inTheme.includes('MUI theme') && inTheme.includes('sx') ? ok('find_token reads a theme colour through the theme') : bad('kit find_token colour', inTheme);
  const step = mcpTools.findToken(mk, { value: '12px' });
  step.includes('p: 3') ? ok('find_token turns 12px into a spacing step on a 4px theme') : bad('kit find_token step', step);
  const between = mcpTools.findToken(mk, { value: '13px' });
  between.includes('between steps') ? ok('find_token says when a size is between steps') : bad('kit find_token between', between);
  const kitCode = `import Box from '@mui/material/Box';\nexport const X = () => <Box sx={{ color: '#667085', p: '12px', bgcolor: '#ff0000' }} />;`;
  const { findings } = validateContent({ text: kitCode, file: 'src/components/New.tsx' }, mk);
  const rules = findings.map((f) => f.rule);
  rules.filter((r) => r === 'kit-colour').length === 2 ? ok('a colour on a kit component is a kit finding') : bad('kit-colour', JSON.stringify(rules));
  rules.includes('kit-px') ? ok('a pixel size on a kit component is a kit finding') : bad('kit-px', JSON.stringify(rules));
  !rules.includes('hardcoded-colour') && !rules.includes('off-scale-spacing') ? ok('the kit finding replaces the generic one, not doubles it') : bad('kit double report', JSON.stringify(rules));
  findings.find((f) => f.rule === 'kit-colour' && f.message.includes('#667085'))?.message.includes('already holds it') ? ok('a theme colour is told the theme already holds it') : bad('kit theme colour message', JSON.stringify(findings[0]));
  findings.find((f) => f.rule === 'kit-colour' && f.message.includes('#ff0000'))?.fix.startsWith('Add it to the theme once') ? ok('a colour the theme lacks is told to add it once') : bad('kit new colour fix', JSON.stringify(findings));
  const clean = mcpTools.validate(mk, { code: `import Box from '@mui/material/Box';\nexport const X = () => <Box sx={{ color: 'text.secondary', p: 3 }} />;` });
  clean.startsWith('No measured violations') && clean.includes('kit components') ? ok('a kit file that reads the theme is clean, and the kit check is listed') : bad('kit clean', clean.slice(0, 120));
  const comment = validateContent({ text: `import Box from '@mui/material/Box';\n// #ffffff\nexport const X = () => <Box sx={{ color: theme.palette.x || '#fff' }} />;`, file: 'src/a.tsx' }, mk);
  comment.findings.length === 0 ? ok('a comment and a fallback are not kit paint') : bad('kit comment/fallback', JSON.stringify(comment.findings));
  const plain = validateContent({ text: `export const X = () => <div style={{ color: '#ff0000' }} />;`, file: 'src/b.tsx' }, mk);
  !plain.findings.some((f) => f.rule.startsWith('kit-')) ? ok('a file that does not import the kit gets no kit finding') : bad('kit scope', JSON.stringify(plain.findings));

  const tk = loadKnowledge(join(FIXTURES, 'tailwindtheme'));
  const tctx = mcpTools.getContext(tk, {});
  tctx.includes('TAILWIND THEME: app/globals.css') && tctx.includes('blue-500 is retuned') ? ok('context names the Tailwind theme and its retuned names') : bad('tailwind context', tctx);
  const pal = validateContent({ text: `export const X = () => <span className="text-emerald-600 bg-blue-500 hover:text-gray-500">x</span>;` }, tk);
  const cls = pal.findings.filter((f) => f.rule === 'palette-class').map((f) => f.message.split(' ')[2]);
  JSON.stringify(cls) === JSON.stringify(['text-emerald-600', 'hover:text-gray-500']) ? ok('palette classes are flagged, a retuned name is not') : bad('palette-class', JSON.stringify(pal.findings));
  pal.findings[0].fix.includes('text-ink') ? ok('the fix names a theme class that fits the utility') : bad('palette fix', pal.findings[0].fix);
  // a story is a demo on a Tailwind theme too: the report's tile never counted
  // one, and the live check used to flag it (2026-09-30)
  const tstory = validateContent({ text: `export const X = () => <span className="text-emerald-600">x</span>;`, file: 'src/stories/Badge.tsx' }, tk);
  !tstory.findings.some((f) => f.rule === 'palette-class') ? ok('tailwind theme: a demo folder is not own code') : bad('tailwind demo palette', JSON.stringify(tstory.findings));
  const own = mcpTools.validate(tk, { code: `export const X = () => <span className="text-ink bg-surface border-edge">x</span>;` });
  own.startsWith('No measured violations') && own.includes('palette classes') ? ok('theme names as classes are clean, and the palette check is listed') : bad('tailwind clean', own.slice(0, 120));

  // 2026-09-20: the report's shadcn tile counted a ring-green-500 that
  // validate, review and --check let through; the palette rule ran on
  // Tailwind themes only. Same rule, same files, both doors.
  const sk = loadKnowledge(join(FIXTURES, 'shadcncustom'));
  mcpTools.getContext(sk, {}).includes('never a palette class') ? ok('shadcn context says no palette classes') : bad('shadcn context palette', mcpTools.getContext(sk, {}));
  const tin = `import { Card } from '@/components/ui/card';\nexport const X = () => <Card className="ring-green-500 dark:bg-black bg-primary">x</Card>;`;
  const sp = validateContent({ text: tin, file: 'src/app/x.tsx' }, sk);
  const spc = sp.findings.filter((f) => f.rule === 'palette-class').map((f) => f.message.split(' ')[2]);
  JSON.stringify(spc) === JSON.stringify(['ring-green-500', 'dark:bg-black']) ? ok('shadcn: palette classes and a hand-painted dark override are flagged, a theme class is not') : bad('shadcn palette-class', JSON.stringify(sp.findings));
  sp.findings[0].message.includes('src/styles/globals.css') && sp.findings[0].fix.includes('ring-border') ? ok('shadcn: the finding names the sheet and a theme class for the utility') : bad('shadcn palette fix', JSON.stringify(sp.findings[0]));
  validateContent({ text: tin, file: 'src/components/ui/card.tsx' }, sk).findings.some((f) => f.rule === 'palette-class') ? bad('shadcn catalogue palette', 'flagged inside the catalogue') : ok('shadcn: the catalogue is the kit\'s own door, not judged for palette');
  // 9.5.0: a component of the team's own kept in the catalogue folder is not a door
  validateContent({ text: tin, file: 'src/components/ui/status-banner.tsx' }, sk).findings.some((f) => f.rule === 'palette-class') ? ok('shadcn: a team component kept in the catalogue folder is judged like own code') : bad('team component in catalogue', 'not judged');
  validateContent({ text: tin, file: 'src/stories/x.tsx' }, sk).findings.some((f) => f.rule === 'palette-class') ? bad('shadcn demo palette', 'flagged in a stories folder') : ok('shadcn: a demo folder is not own code');
  // a templates folder in a product is a screen (teable's admin templates,
  // documenso's template picker): judged like any screen (2026-09-30)
  validateContent({ text: tin, file: 'src/features/templates/TemplatePicker.tsx' }, sk).findings.some((f) => f.rule === 'palette-class') ? ok('shadcn: a templates screen in the product is own code') : bad('shadcn templates screen', 'a template picker went unjudged');
  const sclean = mcpTools.validate(sk, { code: `export const X = () => <span className="text-muted-foreground bg-card">x</span>;` });
  sclean.startsWith('No measured violations') && sclean.includes('palette classes') ? ok('shadcn: theme classes are clean, and the palette check is listed') : bad('shadcn clean', sclean.slice(0, 160));

  // 2026-09-20: a duplicate named without its paths is a claim the agent
  // re-checks in src/ alone, then disputes. The receipt travels with it.
  const mctx = mcpTools.getContext(loadKnowledge(join(FIXTURES, 'messy')), {});
  /<Button> exists in 2 places \([^)]*\.(tsx|jsx)[^)]*, [^)]*\.(tsx|jsx)[^)]*\)/.test(mctx) ? ok('context names both files of a duplicate') : bad('duplicate paths in context', mctx.split('\n').find((l) => l.includes('exists in')) ?? mctx);


  // 2026-09-20: a palette class named in a comment is not paint, on either door
  const noted = `import { Card } from '@/components/ui/card';
{/* border-green-500 is deliberate: no green token yet */}
// see also text-gray-500 in the old design
export const X = () => <Card className="border-green-500">x</Card>; // https://example.com/text-red-500`;
  const nf = validateContent({ text: noted, file: 'src/app/y.tsx' }, sk).findings.filter((f) => f.rule === 'palette-class');
  nf.length === 1 && nf[0].line === 4 ? ok('shadcn: a class in a comment is not paint, the real one keeps its line number') : bad('comment palette', JSON.stringify(nf));
  nf[0]?.fix.includes('theme token') && nf[0].fix.includes('border-success') ? ok('the palette fix says token and shows the class that results') : bad('palette fix wording', nf[0]?.fix);
  const tnf = validateContent({ text: `// text-emerald-600 was the old accent\nexport const X = () => <span className="text-ink">x</span>;` }, tk).findings.filter((f) => f.rule === 'palette-class');
  tnf.length === 0 ? ok('tailwind theme: a class in a comment is not paint') : bad('tailwind comment palette', JSON.stringify(tnf));

  // 9.4.0: one palette rule for every door, decided from what the theme
  // holds rather than from the kind (lib/palette.mjs). Probed 2026-10-01:
  // the guard was silent on 11 of 48 fleet shadcn repos where the live
  // checks spoke, and the live checks flagged rybbit in utility-class mode.
  const split = loadKnowledge(join(FIXTURES, 'shadcnsplit'));
  split.palette?.source === 'shadcn' ? ok('shadcn: the contract holds when a sibling package keeps the rows and the configured sheet has none under :root') : bad('split sheet palette', JSON.stringify(split.palette));
  const splitHit = validateContent({ text: tin, file: 'src/app/x.tsx' }, split).findings.filter((f) => f.rule === 'palette-class').map((f) => f.message.split(' ')[2]);
  JSON.stringify(splitHit) === JSON.stringify(['ring-green-500', 'dark:bg-black']) ? ok('shadcn: a split sheet gets the same palette findings') : bad('split sheet findings', JSON.stringify(splitHit));
  const util = loadKnowledge(join(FIXTURES, 'shadcnutil'));
  util.palette === null ? ok('shadcn in utility-class mode: the palette is the theme, so the rule is off') : bad('utility palette', JSON.stringify(util.palette));
  !validateContent({ text: tin, file: 'src/app/x.tsx' }, util).findings.some((f) => f.rule === 'palette-class') ? ok('utility-class mode: a palette class is not flagged') : bad('utility palette finding', 'flagged');
  !mcpTools.validate(util, { code: `export const X = () => <span className="text-ink">x</span>;` }).includes('palette classes') ? ok('utility-class mode: the palette check is not listed as run') : bad('utility checked list', 'listed');
  const ownk = loadKnowledge(join(FIXTURES, 'shadcnown'));
  ownk.palette?.source === 'tailwind' && ownk.palette.names.includes('ink') ? ok('shadcn with no rows but a theme of its own: the theme is the vocabulary') : bad('own theme palette', JSON.stringify(ownk.palette));
  const ownCode = `export const X = () => <span className="text-gray-500 bg-blue-500 dark:bg-black">x</span>;`;
  const ownHit = validateContent({ text: ownCode, file: 'src/app/x.tsx' }, ownk).findings.filter((f) => f.rule === 'palette-class');
  ownHit.map((f) => f.message.split(' ')[2]).join() === 'text-gray-500,bg-blue-500' ? ok('own theme under a shadcn kit: palette classes are flagged, the dark override is a Tailwind-theme matter') : bad('own theme findings', JSON.stringify(ownHit));
  ownHit[0]?.fix.includes('text-ink') && ownHit[0].message.includes('src/app/globals.css') ? ok('own theme: the fix names the theme\'s own class and file') : bad('own theme fix', JSON.stringify(ownHit[0]));
  !validateContent({ text: ownCode, file: 'src/components/ui/card.tsx' }, ownk).findings.some((f) => f.rule === 'palette-class') ? ok('own theme: the catalogue is still the kit\'s door') : bad('own theme catalogue', 'flagged inside the catalogue');
}

// 9.5.0: the catalogue folder is not all shadcn's. A component of the team's
// own kept there is own code for every tile, the live checks and the guard.
// Probed 2026-10-01: 33 of 44 fleet shadcn repos keep their own components in
// the folder, 1,014 of 2,709 files, with 1,285 palette classes nothing counted.
console.log('the catalogue folder, file by file (9.5.0):');
{
  const { validateContent } = await import(pathToFileURL(join(ENGINE, 'mcp/engine.mjs')).href);
  const { isShadcnFile, installedFile } = await import(pathToFileURL(join(ENGINE, 'profiles/installed.mjs')).href);
  isShadcnFile('components/ui/button.tsx') && isShadcnFile('src/ui/Avatar.tsx') && isShadcnFile('components/ui/alert-dialog/index.tsx') && isShadcnFile('components/app-sidebar.tsx')
    ? ok('shadcn\'s components are known however they are spelt (button, Avatar, a folder index, a kit block)') : bad('shadcn names', 'a shadcn component was not recognised');
  !isShadcnFile('components/ui/status-banner.tsx') && !isShadcnFile('components/ui/InvoiceTable.tsx') ? ok('a name shadcn never shipped is not shadcn\'s') : bad('team names', 'a team component read as shadcn\'s');
  const P = { uiDirs: ['components/ui'], shadcn: { blockFiles: ['components/app-sidebar.tsx'], registryDirs: ['components/ai-elements'] } };
  installedFile(P, 'components/ui/card.tsx') && installedFile(P, 'components/app-sidebar.tsx') && installedFile(P, 'components/ai-elements/message.tsx') && !installedFile(P, 'components/ui/status-banner.tsx') && !installedFile(P, 'app/page.tsx')
    ? ok('installed: shadcn\'s components, kit blocks and registries; the team\'s own file in the folder is not') : bad('installedFile', 'wrong split');

  const mh = JSON.parse(readFileSync(join(tmp, 'shadcnmixed.json'), 'utf8'));
  const inst = (mh.profile.shadcn.arbitraryInstalled?.values ?? []).map((v) => v.value).sort().join(',');
  inst === '[2.25rem],[3px]' ? ok('bracket values in shadcn\'s components (Avatar.tsx included) stay out of the count') : bad('installed brackets', inst);
  (mh.tokens.tailwind.arbitrary ?? []).some((a) => a.value === '[13px]') && !(mh.profile.shadcn.arbitraryInstalled?.values ?? []).some((v) => v.value === '[13px]')
    ? ok('a bracket value in the team\'s own component in the folder is the team\'s') : bad('team bracket', 'not counted as own');
  const tin = (mh.profile.shadcn.paint?.tin?.samples ?? []).map((x) => x.value).sort().join(',');
  tin === 'bg-amber-50,text-amber-600' ? ok('palette classes in the team\'s own component in the folder are counted') : bad('team paint', tin);
  const mk = loadKnowledge(join(FIXTURES, 'shadcnmixed'));
  const snippet = 'export const X = () => <div className="px-3 text-[13px] text-amber-600">x</div>;';
  const bf = validateContent({ text: snippet, file: 'components/ui/status-banner.tsx' }, mk).findings.map((f) => f.rule);
  bf.includes('palette-class') && bf.includes('arbitrary-value') ? ok('the live check judges the team\'s own component in the folder') : bad('live check team file', JSON.stringify(bf));
  const sf = validateContent({ text: snippet, file: 'components/ui/button.tsx' }, mk).findings.map((f) => f.rule);
  !sf.includes('arbitrary-value') && !sf.includes('palette-class') ? ok('the live check leaves shadcn\'s own component alone') : bad('live check shadcn file', JSON.stringify(sf));
}

// 9.5.0: shadcn in utility-class mode gets the words Greg approved on
// 2026-10-01, not "use the theme variables, never a palette colour".
console.log('utility-class shadcn in the rules file (9.5.0):');
{
  const rt = (fx) => rulesMarkdown(JSON.parse(readFileSync(join(tmp, `${fx}.json`), 'utf8'))).text;
  const own = rt('shadcnutiltheme');
  own.includes('so the components paint with Tailwind classes. The theme file, `src/app/globals.css`, gives neutral-50 to neutral-950 this repo\'s own values, and names destructive, accent and the chart colours. Use those classes. Never a palette colour the theme does not own, such as `text-red-500`; use `text-destructive`, or add the colour to the theme once.')
    ? ok('a theme of its own: the approved words, filled from the repo') : bad('utility own-theme words', own.slice(own.indexOf('shadcn is installed'), own.indexOf('shadcn is installed') + 500));
  !own.includes('never a palette colour like') && !own.includes('The theme is a set of CSS variables') ? ok('no "theme variables, never a palette colour" on a utility install') : bad('utility contradiction', 'old words still there');
  /palette colours the theme does not own already sit in own code, `text-red-500` ×2/.test(own) ? ok('the count names only the colours the theme does not own') : bad('utility own-theme count', own);
  const plain = rt('shadcnutil');
  plain.includes('so the components paint with Tailwind\'s palette classes by design. Stay with the shades they already use (`bg-zinc-900`, `text-zinc-50`). Never a hex, an rgb() or a bracket colour.')
    ? ok('no theme of its own: the approved words, with the shades the components use') : bad('utility plain words', plain.slice(plain.indexOf('shadcn is installed'), plain.indexOf('shadcn is installed') + 400));
  !/palette colours? already sit in own code/.test(plain) ? ok('the palette is the system there, so no "do not add palette colours" line') : bad('utility plain count', 'line still there');
}

// 9.6.0: one class reader for the report and the live checks. Until then
// the live checks read className only, and cn("text-[13px]") was counted by
// the report and never flagged (3,794 values in 66 fleet repos, 2026-10-01).
console.log('class strings, one reader (9.6.0):');
{
  const { validateContent } = await import(pathToFileURL(join(ENGINE, 'mcp/engine.mjs')).href);
  const { classStringSpans, extractStyling } = await import(pathToFileURL(join(ENGINE, 'harvest/tokens.mjs')).href);
  const k = loadKnowledge(join(FIXTURES, 'shadcncustom'));
  const code = [
    'import { cn } from "@/lib/utils";',                       // 1
    'import { cva } from "class-variance-authority";',          // 2
    'const v = cva("inline-flex h-[2.5rem]");',                 // 3
    'export const X = ({ a }) => (',                            // 4
    '  <p className={cn(',                                      // 5
    '    "flex items-center",',                                 // 6
    '    "text-[15px] p-[7px] bg-[#1a1a1a]",',                  // 7
    '    a && "rounded-[9px]",',                                // 8
    '  )}>',                                                    // 9
    '    <span className={`gap-2',                              // 10
    '      w-[137px]`} />',                                     // 11
    '  </p>',                                                   // 12
    ');',                                                       // 13
  ].join('\n');
  const f = validateContent({ text: code, file: 'src/app/probe.tsx' }, k).findings;
  const at = (rule) => f.filter((x) => x.rule === rule).map((x) => `${x.message.match(/\[[^\]]+\]|\d+(?:\.\d+)?(?:px|rem)|#[0-9a-f]{3,8}/i)?.[0]}@${x.line}`).sort().join(' ');
  at('arbitrary-value') === '[137px]@11 [15px]@7 [2.5rem]@3 [9px]@8'
    ? ok('bracket values inside cva() and a multi-line cn() are flagged, each on its own line') : bad('class reader: brackets', at('arbitrary-value') + ' | ' + JSON.stringify(f.map((x) => x.rule + '@' + x.line)));
  f.some((x) => x.rule === 'off-scale-spacing' && x.line === 7) ? ok('a spacing bracket inside cn() is judged by the spacing rule') : bad('class reader: spacing', JSON.stringify(f.map((x) => x.rule + '@' + x.line)));
  f.filter((x) => /#1a1a1a/i.test(x.message)).length === 1 ? ok('a hex bracket colour inside cn() is reported once, not twice') : bad('class reader: hex once', JSON.stringify(f.filter((x) => /1a1a1a/.test(x.message))));
  f.some((x) => x.rule === 'arbitrary-value' && x.line === 11) ? ok('a class on the second line of a className template is reported on that line') : bad('class reader: template line', 'wrong line');
  // the report reads exactly what it read before: the strings and their order
  const old = (src) => {
    const out = [];
    for (const m of src.matchAll(/class(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g)) out.push(m[1] ?? m[2] ?? m[3] ?? '');
    for (const m of src.matchAll(/\b(?:cva|cn|clsx|classnames|twMerge)\s*\(([\s\S]{0,2000}?)\)/g)) for (const s of m[1].matchAll(/["'`]([^"'`]+)["'`]/g)) out.push(s[1]);
    return out;
  };
  const sample = code + '\n<div className="" />\n<b className={``} />\n<i class=\'a b\' />\ncn("x", rgba(0,0,0), "y")';
  const spans = classStringSpans(sample);
  JSON.stringify(spans.map((x) => x.text)) === JSON.stringify(old(sample)) ? ok('the report reads the same class strings, in the same order, as before') : bad('class reader: same strings', JSON.stringify(spans.map((x) => x.text)));
  spans.every((x) => sample.slice(x.index, x.index + x.text.length) === x.text) ? ok('every class string knows where it starts') : bad('class reader: positions', JSON.stringify(spans.filter((x) => sample.slice(x.index, x.index + x.text.length) !== x.text)));
  extractStyling('<div className="p-2 text-[13px]" />').arbitrary.length === 1 ? ok('a plain className is read as before') : bad('class reader: className', 'changed');
}

// 9.6.0: a registry's own work is never installed code, and installed values
// are named by their owner. magicui publishes from a folder named magicui,
// also the name of a third-party registry, and the report called its own
// components installed; ai-chatbot's "30 inside ui" were 20 in ui, 2 in a
// kit block and 8 in the ai-elements registry (2026-10-01).
console.log('a registry\'s own work, and installed values by owner (9.6.0):');
{
  const work = mkdtempSync(join(tmpdir(), 'roast-owner-'));
  // a registry that publishes from a folder named like a third-party registry
  const reg = join(work, 'named');
  cpSync(join(FIXTURES, 'registry'), reg, { recursive: true });
  rmSync(join(reg, 'registry/base'), { recursive: true, force: true });
  renameSync(join(reg, 'registry/radix/ui'), join(reg, 'registry/magicui'));
  rmSync(join(reg, 'registry/radix'), { recursive: true, force: true });
  writeFileSync(join(reg, 'registry.json'), readFileSync(join(reg, 'registry.json'), 'utf8').replaceAll('registry/radix/ui/', 'registry/magicui/'));
  writeFileSync(join(reg, 'registry/magicui/tag.tsx'), readFileSync(join(reg, 'registry/magicui/tag.tsx'), 'utf8') + '\nexport const TagWide = () => <span className="text-[11px] w-[280px]" />;\n');
  runEngine('harvest/index.mjs', [reg, '--out', join(work, 'named.json')]);
  const rh = JSON.parse(readFileSync(join(work, 'named.json'), 'utf8'));
  rh.profile.kind === 'registry' && !(rh.profile.shadcn.registryDirs ?? []).includes('registry/magicui')
    ? ok('a registry\'s published folder is its own work, whatever it is called') : bad('registry own folder', JSON.stringify({ kind: rh.profile.kind, regs: rh.profile.shadcn?.registryDirs }));
  (rh.profile.shadcn.arbitraryInstalled?.uses ?? 0) === 0 && (rh.tokens.tailwind.arbitrary ?? []).some((a) => a.value === '[11px]')
    ? ok('its bracket values count as its own, none kept out as installed') : bad('registry own values', JSON.stringify(rh.profile.shadcn.arbitraryInstalled));
  !(rh.profile.kindEvidence ?? []).some((e) => /installed registr/.test(e)) ? ok('the evidence no longer calls its own folder an installed registry') : bad('registry evidence', JSON.stringify(rh.profile.kindEvidence));

  // a shadcn app with installed values in ui, a kit block and a registry
  const app = join(work, 'app');
  cpSync(join(FIXTURES, 'shadcncustom'), app, { recursive: true });
  const add = (f, line) => writeFileSync(join(app, f), readFileSync(join(app, f), 'utf8') + `\n${line}\n`);
  add('src/components/ui/badge.tsx', 'export const BadgeRing = () => <span className="ring-[3px] ring-[3px]" />;');
  writeFileSync(join(app, 'src/components/app-sidebar.tsx'), 'export function AppSidebar() { return <nav className="text-[13px]" />; }\n');
  add('src/components/ai-elements/message.tsx', 'export const Bubble = () => <div className="max-w-[280px]" />;');
  runEngine('harvest/index.mjs', [app, '--out', join(work, 'app.json')]);
  runEngine('diagnose/index.mjs', [join(work, 'app.json'), '--out', join(work, 'app.html'), '--summary', join(work, 'app-s.json')]);
  const html = readFileSync(join(work, 'app.html'), 'utf8').replace(/&#39;/g, "'");
  html.includes('3 bracket values inside ui and the app-sidebar block are shadcn\'s own ([3px], [13px]) and are not counted.')
    ? ok('shadcn\'s values are named with the folder and the block they sit in') : bad('owner shadcn sentence', (html.match(/[^>]*inside ui[^<]*/) ?? ['none'])[0]);
  html.includes('1 bracket value inside the ai-elements registry is the registry\'s own ([280px]) and is not counted. It was written for those components, not as a pattern for your own code.')
    ? ok('a registry\'s value is named as the registry\'s own, with its own reason') : bad('owner registry sentence', (html.match(/[^>]*ai-elements registry[^<]*/) ?? ['none'])[0]);
  const rules = rulesMarkdown(JSON.parse(readFileSync(join(work, 'app.json'), 'utf8'))).text;
  /are shadcn's, not a pattern to copy\. The installed components use a few values Tailwind's scale does not have \(`\[3px\]`, `\[13px\]`\)/.test(rules)
    ? ok('the rules file quotes only shadcn\'s own values') : bad('rules shadcn values', (rules.match(/Bracket values in[^\n]*/) ?? ['none'])[0]);
  rmSync(work, { recursive: true, force: true });
}

// 9.6.1: a file that imports only the team's layer over the kit is a kit
// file for the live checks too. The live checks built the layer pattern in a
// template string with a single backslash, so it never matched: they judged
// 750 of Linode's 1,487 kit files (2026-10-01).
console.log('a kit layer in the live checks (9.6.1):');
{
  const { validateContent } = await import(pathToFileURL(join(ENGINE, 'mcp/engine.mjs')).href);
  const { kitImportRe } = await import(pathToFileURL(join(ENGINE, 'lib/kitpaint.mjs')).href);
  const re = kitImportRe({ importRe: /from\s+['"]@mui\//, themeRe: /x/ }, ['@acme/ui']);
  re.test("import { Box } from '@acme/ui';") && re.test('import { Box } from "@acme/ui/box";') && !re.test("import { y } from '@acme/uix';")
    ? ok('the layer pattern matches an import of the layer, and only the layer') : bad('layer pattern', re.source);
  const work = mkdtempSync(join(tmpdir(), 'roast-layer-'));
  const app = join(work, 'app');
  cpSync(join(FIXTURES, 'muikit'), app, { recursive: true });
  mkdirSync(join(app, 'packages/ui/src'), { recursive: true });
  writeFileSync(join(app, 'packages/ui/package.json'), '{ "name": "@acme/ui", "private": true }\n');
  for (const c of ['Box', 'Stack', 'Typography']) writeFileSync(join(app, `packages/ui/src/${c}.ts`), `export { default as ${c} } from '@mui/material/${c}';\n`);
  const banner = "import { Box } from '@acme/ui';\nexport const Banner = () => <Box sx={{ bgcolor: '#ff0000', p: '13px' }}>x</Box>;\n";
  writeFileSync(join(app, 'src/components/Banner.tsx'), banner);
  const k = loadKnowledge(app);
  (k.kit?.layers ?? []).includes('@acme/ui') ? ok('the team\'s layer over the kit is recognised') : bad('layer recognised', JSON.stringify(k.kit?.layers));
  const rules = validateContent({ text: banner, file: 'src/components/Banner.tsx' }, k).findings.map((f) => f.rule).sort().join(',');
  rules === 'kit-colour,kit-px' ? ok('a file that imports only the layer is judged by the kit rule') : bad('layer file judged', rules || 'nothing');
  rmSync(work, { recursive: true, force: true });
}

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

    // roast-fix: the dynamic prompt runs the real report pipeline, so its
    // text must be byte-identical to the report button's prompt (plus the
    // progression footer). One composer, two doors — tested, not assumed.
    const fixMsgs = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 4, method: 'prompts/get', params: { name: 'roast-fix' } },
    ].map((m) => JSON.stringify(m)).join('\n') + '\n';
    const fr = spawnSync(process.execPath, [join(ENGINE, 'mcp/server.mjs'), join(FIXTURES, 'trapped')],
      { input: fixMsgs, encoding: 'utf8', timeout: 60000 });
    const fixReply = fr.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((x) => x.id === 4);
    const fixText = fixReply?.result?.messages?.[0]?.content?.text ?? '';
    const trapSummary = JSON.parse(readFileSync(join(tmp, 'trapped-s.json'), 'utf8'));
    const reportPrompt = trapSummary.moves?.[0]?.prompt ?? '(no moves in summary)';
    fixText.startsWith(reportPrompt) ? ok('roast-fix serves the report button prompt, byte for byte')
      : bad('roast-fix matches report prompt', `mcp starts: ${fixText.slice(0, 60)} · report starts: ${reportPrompt.slice(0, 60)}`);
    fixText.includes('the next move rises to the top') ? ok('roast-fix explains the progression loop')
      : bad('roast-fix progression footer', 'missing');
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
// (guarded so the suite also runs from a bare engine checkout).
const bin = resolve(ENGINE, '../../../cli/roast.mjs');
if (existsSync(bin)) {
  console.log('npx wrapper:');
  // Zero dependencies is enforced, not aspirational: a stray `npm install`
  // once wrote a dependency into package.json and five releases shipped it
  // (5.4.1's conformance sweep left checkmcp behind; Greg caught it on
  // Socket, fixed in 5.5.4). The promise now has a tripwire.
  const pkg = JSON.parse(readFileSync(resolve(ENGINE, '../../../package.json'), 'utf8'));
  const declared = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies, ...pkg.optionalDependencies });
  declared.length === 0 ? ok('package declares zero dependencies')
    : bad('package declares zero dependencies', `found: ${declared.join(', ')}`);

  // What ships is a contract, both directions: a stowaway file appearing in
  // the tarball or expected cargo going missing (a bad sync) both fail here.
  // Born from 5.5.4: a stray `npm install` shipped a dependency for four days
  // before a human noticed. Machines notice now.
  const packRoot = resolve(ENGINE, '../../..');
  const packRun = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: packRoot, encoding: 'utf8' });
  try {
    const parsed = JSON.parse(packRun.stdout);
    const entry = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0];
    const manifest = entry.files.map((f) => f.path ?? f).sort().join('\n');
    compare('tarball manifest snapshot', manifest, 'pack-manifest.txt');
  } catch (e) { bad('tarball manifest snapshot', `npm pack --dry-run failed: ${e.message}`); }
  const { version, ...pkgContract } = pkg;
  compare('package.json contract snapshot', JSON.stringify(pkgContract, null, 2), 'package-contract.json');
  // Flags before the path: `--out x.html <repo>` used to read x.html as the
  // repo and die with "Not a directory" (6.0.1 and every version before it).
  const flagFirst = spawnSync(process.execPath, [bin, '--out', join(tmp, 'flag-first.html'), join(FIXTURES, 'clean'), '--no-open'], { encoding: 'utf8' });
  flagFirst.status === 0 && existsSync(join(tmp, 'flag-first.html'))
    ? ok('--out before the path still finds the repo') : bad('--out before the path', flagFirst.stderr.trim().split('\n')[0]);
  const r = spawnSync(process.execPath, [bin, join(FIXTURES, 'messy'), '--json', '--out', join(tmp, 'e2e.html')], { encoding: 'utf8' });
  try {
    const j = JSON.parse(r.stdout);
    const want = JSON.parse(readFileSync(join(EXPECTED, 'messy.summary.json'), 'utf8'));
    j.score === want.score ? ok(`--json e2e score ${j.score}`) : bad('--json e2e score', `want ${want.score}, got ${j.score}`);
  } catch (e) { bad('--json e2e', `stdout was not clean JSON: ${e.message}`); }

  // The browser tab is for the moment the number moves, not for every run.
  // An agent working a fix re-runs the scan repeatedly, and each run used to
  // throw a window in the user's face (Greg, fix loop through Claude Code,
  // 2026-09-10). A stub on PATH stands in for `open`, so the suite itself
  // never opens anything and can still count how often it would have.
  const stubDir = join(tmp, 'stub');
  mkdirSync(stubDir, { recursive: true });
  const opened = join(tmp, 'opened.log');
  for (const name of ['open', 'xdg-open']) {
    writeFileSync(join(stubDir, name), `#!/bin/sh\necho "$*" >> ${opened}\n`);
    spawnSync('chmod', ['+x', join(stubDir, name)]);
  }
  // the stub must be found first: a PATH for this one call, and nothing else
  const withStub = { PATH: `${stubDir}:/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin` };
  const opens = () => { try { return readFileSync(opened, 'utf8').trim().split('\n').filter(Boolean).length; } catch { return 0; } };
  const reportDir = join(tmp, 'openflow');
  mkdirSync(reportDir, { recursive: true });
  const report = join(reportDir, 'r.html');
  const scan = () => spawnSync(process.execPath, [bin, join(FIXTURES, 'clean'), '--out', report], { encoding: 'utf8', env: withStub });

  scan();
  opens() === 1 ? ok('the first scan opens the report') : bad('first scan', `opened ${opens()} times`);
  readFileSync(report, 'utf8').includes('<!-- rmds-score:')
    ? ok('the report carries its score for the next run to compare') : bad('score marker', 'missing from the report');

  const again = scan();
  opens() === 1 && again.stdout.includes('score unchanged')
    ? ok('an unchanged score opens nothing') : bad('unchanged run', `opened ${opens()} times`);

  // Move the number: the same report path, a repo with a different score.
  const moved = spawnSync(process.execPath, [bin, join(FIXTURES, 'messy'), '--out', report], { encoding: 'utf8', env: withStub });
  opens() === 2 && !moved.stdout.includes('score unchanged')
    ? ok('a score that moved opens the report') : bad('changed run', `opened ${opens()} times, stdout said ${moved.stdout.includes('unchanged') ? 'unchanged' : 'moved'}`);

  const q = spawnSync(process.execPath, [bin, join(FIXTURES, 'clean'), '--no-open', '--out', join(tmp, 'q.html')], { encoding: 'utf8', env: withStub });
  !q.stdout.includes('score unchanged') && opens() === 2
    ? ok('--no-open stays silent and opens nothing') : bad('--no-open', `opened ${opens()} times`);
}

// The guard doorway (8.4.5): the comment blanker the report and the live
// checks run before matching palette classes is exposed, so a guard that
// reads the same doorway stops counting a class named in a comment.
{
  console.log('\nguard doorway:');
  const api = await import(pathToFileURL(join(ENGINE, 'lib/guard-api.mjs')).href);
  const src = '{/* border-green-500 is deliberate */}\nconst a = "bg-blue-500"; // text-red-500\n';
  const named = (t) => [...t.matchAll(new RegExp(api.PALETTE_CLASS_RE.source, 'g'))].map((m) => m[0]);
  typeof api.blankComments === 'function'
    ? ok('the doorway exposes blankComments') : bad('doorway', 'blankComments is not exported');
  const blanked = api.blankComments(src);
  named(blanked).join(',') === 'bg-blue-500' && blanked.split('\n').length === src.split('\n').length
    ? ok('a palette class in a comment paints nothing, and line numbers hold')
    : bad('blankComments', `got ${named(blanked).join(',') || 'nothing'}`);

  // 8.4.6: the kit and the kit judgement go through the same doorway, so a
  // guard says about a kit line exactly what validate and review say
  const sys = api.learnSystem(join(FIXTURES, 'muikit'));
  // 9.4.0: the palette rule through the doorway, decided as the live checks decide it
  const twSys = api.learnSystem(join(FIXTURES, 'tailwindtheme'));
  twSys.profile.palette?.source === 'tailwind' && twSys.profile.palette.names.includes('ink') ? ok('doorway: a Tailwind theme hands its names to the palette rule') : bad('doorway tailwind palette', JSON.stringify(twSys.profile.palette));
  const twHits = api.paletteFindings('export const X = () => <span className="text-gray-500 text-ink">x</span>;', twSys.profile.palette, { file: 'components/x.tsx' });
  twHits.length === 1 && twHits[0].value === 'text-gray-500' && twHits[0].example.startsWith('text-ink') && twHits[0].themeFile === 'app/globals.css' ? ok('doorway: paletteFindings words the hit as the live check does') : bad('doorway paletteFindings', JSON.stringify(twHits));
  api.paletteFindings('export const X = () => <span className="text-gray-500">x</span>;', twSys.profile.palette, { file: 'src/stories/x.tsx' }).length === 0 ? ok('doorway: a demo folder is left out') : bad('doorway demo', 'flagged');
  api.learnSystem(join(FIXTURES, 'shadcnutil')).profile.palette === null ? ok('doorway: utility-class mode switches the palette rule off') : bad('doorway utility palette', 'expected null');
  api.learnSystem(join(FIXTURES, 'shadcnsplit')).profile.palette?.source === 'shadcn' ? ok('doorway: a split sheet still holds the contract') : bad('doorway split palette', 'expected shadcn');
  // 9.5.0: installed code, file by file, through the doorway
  const mixed = api.learnSystem(join(FIXTURES, 'shadcnmixed')).profile;
  mixed.installedFrom && api.installedFile(mixed.installedFrom, 'components/ui/button.tsx') && !api.installedFile(mixed.installedFrom, 'components/ui/status-banner.tsx')
    ? ok('doorway: installedFile leaves shadcn\'s components out and the team\'s own file in') : bad('doorway installedFile', JSON.stringify(mixed.installedFrom));
  api.paletteFindings('export const X = () => <p className="text-amber-600">x</p>;', mixed.palette, { file: 'components/ui/status-banner.tsx' }).length === 1
    && api.paletteFindings('export const X = () => <p className="text-amber-600">x</p>;', mixed.palette, { file: 'components/ui/card.tsx' }).length === 0
    ? ok('doorway: the palette rule judges the team\'s own file in the folder and leaves shadcn\'s alone') : bad('doorway palette doors', 'wrong');
  sys.profile.kit?.name === 'MUI' && sys.profile.kit.themeFiles[0] === 'src/theme/theme.ts'
    ? ok('the doorway names the kit and its theme file') : bad('doorway kit', JSON.stringify(sys.profile.kit));
  sys.tokens.includes('#667085') ? ok('the theme colours are the token set on a kit repo') : bad('doorway kit tokens', sys.tokens.join(','));
  const kitCode = `import Box from '@mui/material/Box';\nexport const X = () => <Box sx={{ color: '#667085', p: '12px', bgcolor: '#ff0000' }} />;`;
  const judged = api.kitPaintFindings(kitCode, sys.profile.kit, { file: 'src/components/New.tsx' });
  const { validateContent } = await import(pathToFileURL(join(ENGINE, 'mcp/engine.mjs')).href);
  const live = validateContent({ text: kitCode, file: 'src/components/New.tsx' }, loadKnowledge(join(FIXTURES, 'muikit'))).findings
    .filter((f) => f.rule.startsWith('kit-')).map((f) => `${f.rule}|${f.message}|${f.fix}`);
  const door = judged.findings.map((f) => `${f.rule}|${f.message}|${f.fix}`);
  door.length === 3 && door.every((d) => live.includes(d))
    ? ok('the doorway and the live check word a kit line identically') : bad('doorway kit parity', `${door.join('\n')}\nvs\n${live.join('\n')}`);
  api.kitPaintFindings(`export const a = 1;`, sys.profile.kit, { file: 'src/x.ts' }) === null
    ? ok('a file that does not import the kit is not a kit file') : bad('doorway non-kit', 'judged');
}

rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
