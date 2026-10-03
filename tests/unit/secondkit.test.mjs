// A second kit beside the one a product is built on (9.7.0): named in the
// rules file, the MCP context, the report and the live checks, never scored.
// Fourteen of 80 kit products import a second kit in earnest (2026-10-01);
// the rules file sent SigNoz's agents to Ant Design against SigNoz's own lint
// rule, and the live checks gave MUI's fix on an Akamai CDS table cell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { fixture } from './_fixture.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(HERE, '../../skills/roast-my-design-system/scripts');
const FIX = dirname(fixture('twokits'));
const BIN = join(HERE, '../../cli/roast.mjs');

const { walkRepo, profileRepo } = await import(join(ENGINE, 'harvest/walk.mjs'));
const { loadExclusions } = await import(join(ENGINE, 'lib/exclusions.mjs'));
const { harvestComponents } = await import(join(ENGINE, 'harvest/components.mjs'));
const { decideProfile } = await import(join(ENGINE, 'profiles/index.mjs'));
const { KITS } = await import(join(ENGINE, 'profiles/kit-common.mjs'));
const { kitOfSource, importSources, pkgRoot } = await import(join(ENGINE, 'lib/kitlist.mjs'));
const { kitPaintFindings, kitPaintInSource } = await import(join(ENGINE, 'lib/kitpaint.mjs'));
const { rulesMarkdown, kitPair, secondKitRule, secondKitLead } = await import(join(ENGINE, 'rules/build.mjs'));
const { fixPrompt } = await import(join(ENGINE, 'lib/fixprompt.mjs'));
const { loadKnowledge } = await import(join(ENGINE, 'mcp/knowledge.mjs'));
const { getContext, findToken, approxTokens } = await import(join(ENGINE, 'mcp/tools.mjs'));
const { validateContent } = await import(join(ENGINE, 'mcp/engine.mjs'));
const api = await import(join(ENGINE, 'lib/guard-api.mjs'));

// ---------- helpers ----------
function write(root, files) {
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(join(root, dirname(f)), { recursive: true });
    writeFileSync(join(root, f), body);
  }
}
function tempRepo(files, from = null) {
  const root = mkdtempSync(join(tmpdir(), 'roast-twokits-'));
  if (from) cpSync(from, root, { recursive: true });
  write(root, files);
  return root;
}
function profileOfRepo(root) {
  const files = walkRepo(root, 14, loadExclusions(root));
  const profile = profileRepo(root, files);
  const { components } = harvestComponents(root, files.code);
  decideProfile(profile, components, files, root);
  return profile;
}
const many = (n, path, body) => Object.fromEntries(Array.from({ length: n }, (_, i) => [path(i + 1), body(i + 1)]));
const bsFile = (i) => `import { Card } from '@backstage/ui';\nexport const P${i} = () => <Card>p${i}</Card>;\n`;
const muiFile = (i) => `import Box from '@mui/material/Box';\nexport const M${i} = () => <Box sx={{ p: 2 }}>m${i}</Box>;\n`;
const MUI_PKG = '{ "name": "app", "private": true, "dependencies": { "@mui/material": "^7.3.0", "react": "19.2.8" } }\n';
const MUI_THEME = "import { createTheme } from '@mui/material/styles';\nexport const theme = createTheme({ spacing: 4, palette: { primary: { main: '#3355ff' } } });\n";
// an MUI product with n files importing MUI in all (the theme counts as one)
const muiRepo = (n, extra = {}) => tempRepo({ 'package.json': MUI_PKG, 'src/theme/theme.ts': MUI_THEME, ...many(n - 1, (i) => `src/components/C${i}.tsx`, muiFile), ...extra });

// ---------- the shared list ----------
test('a kit is read from the package, never from its icons, hooks or a whole scope', () => {
  assert.equal(kitOfSource('@mui/material/Box'), 'MUI');
  assert.equal(kitOfSource('@mui/x-data-grid'), 'MUI');
  for (const s of ['@mui/icons-material/Close', '@mantine/hooks', '@mantine/form', '@chakra-ui/icons', '@ant-design/icons', '@ant-design/colors', '@filigran/chatbot', '@lobehub/ui', '@linode/ui', 'react-aria-components', '@radix-ui/react-dialog', '@headlessui/react', '@base-ui/react']) {
    assert.equal(kitOfSource(s), null, s);
  }
  assert.equal(kitOfSource('@ant-design/pro-table'), 'Ant Design');
  assert.equal(kitOfSource('@akamai/cds-components/react/Table'), 'Akamai CDS');
  assert.equal(pkgRoot('@akamai/cds-components/react/Table'), '@akamai/cds-components');
  assert.equal(pkgRoot('react-bootstrap/Button'), 'react-bootstrap');
  assert.deepEqual(importSources("import a from 'x';\nconst b = require('y');\nimport('z');"), ['x', 'y']);
});

// ---------- detection ----------
test('a second kit is named with its counts, and the evidence says it is not scored', () => {
  const root = muiRepo(33, many(12, (i) => `src/plugins/P${i}.tsx`, bsFile));
  try {
    const p = profileOfRepo(root);
    assert.equal(p.kind, 'mui');
    assert.deepEqual(p.kit.second, { name: 'Backstage UI', pkg: '@backstage/ui', registered: false, files: 12, withoutFirst: 12, mixed: 0, dir: 'src/plugins', firstDir: null, mixedPaint: { colours: 0, px: 0 } });
    // MUI's files sit in src/components and src/theme: no one folder holds them all
    assert.equal(p.kit.alsoSeen, undefined);
    assert.equal(p.kindEvidence.filter((e) => e.startsWith('Backstage UI imported in 12 files')).length, 1);
    assert.match(p.kindEvidence.at(-1), /: named, not scored$/);
    // plain data: it travels through JSON unchanged
    assert.deepEqual(JSON.parse(JSON.stringify(p.kit.second)), p.kit.second);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('one of the registered kits can be the second', () => {
  const root = muiRepo(33, many(12, (i) => `src/admin/A${i}.tsx`, (i) => `import { Button } from 'antd';\nexport const A${i} = () => <Button>a</Button>;\n`));
  try {
    const p = profileOfRepo(root);
    assert.equal(p.kind, 'mui');
    assert.equal(p.kit.second.name, 'Ant Design');
    assert.equal(p.kit.second.registered, true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a kit's icons and hooks never make a second kit", () => {
  const imports = ["import { CloseOutlined } from '@ant-design/icons';", "import { useDisclosure } from '@mantine/hooks';", "import { AddIcon } from '@chakra-ui/icons';"];
  const root = muiRepo(33, many(40, (i) => `src/icons/I${i}.tsx`, (i) => `${imports[i % 3]}\nexport const I${i} = () => null;\n`));
  try {
    const p = profileOfRepo(root);
    assert.equal(p.kind, 'mui');
    assert.equal(p.kit.second, undefined);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a second kit needs 10 files, and 30 or a tenth of the first', () => {
  const second = (firstN, n) => {
    const root = muiRepo(firstN, many(n, (i) => `src/plugins/P${i}.tsx`, bsFile));
    try { return profileOfRepo(root).kit?.second?.files ?? 0; } finally { rmSync(root, { recursive: true, force: true }); }
  };
  assert.equal(second(33, 9), 0);
  assert.equal(second(120, 11), 0);
  assert.equal(second(120, 12), 12);
  assert.equal(second(400, 30), 30);
});

test("the team's own layer over the first kit is the first kit", () => {
  const layer = {
    'packages/ui/package.json': '{ "name": "@acme/ui", "private": true }\n',
    ...Object.fromEntries(['Box', 'Stack', 'Typography'].map((c) => [`packages/ui/src/${c}.ts`, `export { default as ${c} } from '@mui/material/${c}';\n`])),
    'src/pages/Page.tsx': "import { Box } from '@acme/ui';\nimport { Card } from '@backstage/ui';\nexport const Page = () => <Box><Card>x</Card></Box>;\n",
  };
  const root = muiRepo(33, { ...layer, ...many(11, (i) => `src/plugins/P${i}.tsx`, bsFile) });
  try {
    const p = profileOfRepo(root);
    assert.ok(p.kit.layers.includes('@acme/ui'));
    assert.equal(p.kit.second.files, 12);
    assert.equal(p.kit.second.mixed, 1);
    assert.equal(p.kit.second.withoutFirst, 11);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the biggest second kit is named; the rest are evidence', () => {
  // Backstage UI sorts after Agenta UI by name, so size alone decides
  const agenta = (i) => `import { Tag } from '@agenta/ui';\nexport const G${i} = () => <Tag>g</Tag>;\n`;
  const root = muiRepo(33, { ...many(20, (i) => `src/a/G${i}.tsx`, agenta), ...many(50, (i) => `src/b/P${i}.tsx`, bsFile) });
  try {
    const p = profileOfRepo(root);
    assert.equal(p.kit.second.name, 'Backstage UI');
    assert.deepEqual(p.kit.alsoSeen, [{ name: 'Agenta UI', files: 20 }]);
    assert.ok(p.kindEvidence.includes('Agenta UI also imported in 20 files: named, not scored'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('stories, tests and mocks never make a second kit', () => {
  // stories and mocks folders are walked, so only the kit count's own rule keeps them out
  const root = muiRepo(33, { ...many(8, (i) => `src/stories/S${i}.tsx`, bsFile), ...many(8, (i) => `src/mocks/T${i}.tsx`, bsFile) });
  try { assert.equal(profileOfRepo(root).kit.second, undefined); } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a first kit reached through the team's layer is placed where its files are", () => {
  const root = mkdtempSync(join(tmpdir(), 'roast-twokits-'));
  write(root, {
    'package.json': MUI_PKG,
    'packages/ui/package.json': '{ "name": "@acme/ui", "private": true }\n',
    'packages/ui/src/theme.ts': MUI_THEME,
    ...Object.fromEntries(['Box', 'Stack', 'Typography'].map((c) => [`packages/ui/src/${c}.ts`, `export { default as ${c} } from '@mui/material/${c}';\n`])),
    ...many(40, (i) => `apps/web/P${i}.tsx`, (i) => `import { Box } from '@acme/ui';\nexport const P${i} = () => <Box>p</Box>;\n`),
    ...many(12, (i) => `apps/plugins/B${i}.tsx`, bsFile),
  });
  try {
    const p = profileOfRepo(root);
    assert.ok(p.kit.layers.includes('@acme/ui'));
    assert.notEqual(p.kit.second.firstDir, 'packages');
    assert.equal(p.kit.second.dir, 'apps/plugins');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a rescan after edits reads the files afresh, even when none was added', async () => {
  const { freshKnowledge } = await import(join(ENGINE, 'mcp/knowledge.mjs'));
  const { utimesSync } = await import('node:fs');
  const root = muiRepo(33, many(12, (i) => `src/plugins/P${i}.tsx`, (i) => `export const P${i} = () => null;\n`));
  try {
    const k1 = loadKnowledge(root);
    assert.equal(k1.kit.second, undefined);
    const later = new Date(Date.now() + 5000);
    for (let i = 1; i <= 12; i++) { writeFileSync(join(root, `src/plugins/P${i}.tsx`), bsFile(i)); utimesSync(join(root, `src/plugins/P${i}.tsx`), later, later); }
    const k2 = freshKnowledge(k1);
    assert.notEqual(k2, k1);
    assert.equal(k2.kit.second?.name, 'Backstage UI');
    assert.equal(k2.kit.second.files, 12);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a folder is named only when every file of a kit sits in it, and never a file', () => {
  const root = mkdtempSync(join(tmpdir(), 'roast-twokits-'));
  write(root, { 'package.json': MUI_PKG, 'apps/a/theme.ts': MUI_THEME, ...many(32, (i) => `apps/a/C${i}.tsx`, muiFile), ...many(12, (i) => `apps/b/P${i}.tsx`, bsFile) });
  try {
    const p = profileOfRepo(root);
    assert.equal(p.kit.second.dir, 'apps/b');
    assert.equal(p.kit.second.firstDir, 'apps/a');
  } finally { rmSync(root, { recursive: true, force: true }); }
  // interleaved: the two kits share a folder
  const mixed = muiRepo(33, many(12, (i) => `src/components/P${i}.tsx`, bsFile));
  try {
    const p = profileOfRepo(mixed);
    assert.equal(p.kit.second.dir, null);
    assert.equal(p.kit.second.firstDir, null);
  } finally { rmSync(mixed, { recursive: true, force: true }); }
});

// ---------- the score does not move ----------
test('naming a second kit moves no score and no tile', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'roast-twokits-score-'));
  try {
    const h = join(tmp, 'h.json');
    execFileSync(process.execPath, [join(ENGINE, 'harvest/index.mjs'), join(FIX, 'twokits'), '--out', h], { stdio: 'ignore' });
    const harvest = JSON.parse(readFileSync(h, 'utf8'));
    assert.ok(harvest.profile.kit.second);
    delete harvest.profile.kit.second;
    writeFileSync(join(tmp, 'h0.json'), JSON.stringify(harvest));
    const summary = (hp, s) => { execFileSync(process.execPath, [join(ENGINE, 'diagnose/index.mjs'), hp, '--out', join(tmp, `${s}.html`), '--summary', join(tmp, `${s}.json`)], { stdio: 'ignore' }); return JSON.parse(readFileSync(join(tmp, `${s}.json`), 'utf8')); };
    const a = summary(h, 'with'), b = summary(join(tmp, 'h0.json'), 'without');
    assert.equal(a.score, b.score);
    assert.deepEqual(a.tiles, b.tiles);
    assert.deepEqual(a.kit.second, { name: 'Backstage UI', pkg: '@backstage/ui', files: 14, withoutFirst: 11, mixed: 3 });
    assert.equal(b.kit.second, undefined);
    // the report: the receipt, the two-kit block and the note on the kit moves
    const html = readFileSync(join(tmp, 'with.html'), 'utf8');
    assert.match(html, /Backstage UI is imported in 14 files too, 11 of them without MUI\. Those 11 files are not in the kit counts/);
    assert.match(html, /Two kits · Backstage UI in 14 files/);
    assert.match(html, /11 files use Backstage UI without MUI\. They are not in the counts above\./);
    assert.match(html, /3 files use both kits and are counted\. 6 of the colours and 7 of the pixel sizes above are in those files, so some may be on Backstage UI components/);
    assert.match(html, /In the 3 files that also use Backstage UI, change only what sits on MUI components\./);
    assert.match(html, /- This repo also uses Backstage UI \(@backstage\/ui\)\. Make these changes only on MUI components/);
    const plain = readFileSync(join(tmp, 'without.html'), 'utf8');
    assert.doesNotMatch(plain, /Two kits|imported in \d+ files too|also uses? Backstage UI/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// ---------- the rules file ----------
const FORBIDDEN = /migrat|legacy|prefer|\bold\b|\bmain\b|\bnew kit\b/i;
test('the rules file names both kits, biggest first, and takes no side', () => {
  const kit = (mui, bs) => ({ name: 'MUI', kitFiles: mui, themeFiles: ['src/theme/theme.ts'], colour: { uses: 0, samples: [] }, px: { uses: 0, samples: [] }, layers: [], second: { name: 'Backstage UI', pkg: '@backstage/ui', registered: false, files: bs, withoutFirst: bs - 3, mixed: 3, dir: null, firstDir: null, mixedPaint: { colours: 0, px: 0 } } });
  assert.deepEqual(kitPair(kit(500, 164)).map((x) => x.name), ['MUI', 'Backstage UI']);
  assert.deepEqual(kitPair(kit(100, 164)).map((x) => x.name), ['Backstage UI', 'MUI']);
  const text = rulesMarkdown(loadHarvest('twokits')).text;
  const lines = text.split('\n');
  // the kit section opens with both kits, then the first kit's theme, then whose rules these are
  const at = lines.indexOf('### MUI: the theme and the components');
  assert.equal(lines[at + 2], "- This repo uses two kits: MUI (35 files) and Backstage UI (`@backstage/ui`, 14 files in `src/plugins`). Follow the kit the file already uses. Add to that kit rather than building a second version of something it already has. Never put one kit's styling on the other's components.");
  assert.match(lines[at + 3], /^- On MUI components: a colour, a spacing step or a radius is decided in `src\/theme\/theme\.ts`\./);
  assert.equal(lines[at + 4], '- The rules in this section are for MUI components. Backstage UI (`@backstage/ui`) is imported in 14 files, 11 of them without MUI. On Backstage UI components, copy how nearby files style them.');
  // nothing names one kit as the product's base, or a direction
  assert.doesNotMatch(text, /built on MUI|Prefer extending it/);
  assert.doesNotMatch(lines.slice(at + 2, at + 5).join('\n'), FORBIDDEN);
  // compact keeps all three
  const compact = rulesMarkdown(loadHarvest('twokits'), { compact: true }).text;
  for (const l of lines.slice(at + 2, at + 5)) assert.ok(compact.includes(l), l);
  // none of it without a second kit
  const one = rulesMarkdown(loadHarvest('muikit')).text;
  assert.doesNotMatch(one, /two kits|The rules in this section are for|On MUI components/);
  assert.match(one, /This product is built on MUI/);
  // the counts read right at the edges
  const only = { ...kit(500, 20), second: { ...kit(500, 20).second, withoutFirst: 20, mixed: 0 } };
  assert.match(secondKitRule(only), /imported in 20 files, none of them with MUI\./);
  assert.doesNotMatch(secondKitRule({ ...kit(500, 3), second: { ...kit(500, 3).second, withoutFirst: 0 } }), /without|none/);
  // a third kit seen in earnest is named, so "two kits" is never untrue
  assert.match(secondKitLead({ ...kit(500, 164), alsoSeen: [{ name: 'Agenta UI', files: 40 }] }), /^This repo uses more than one kit: MUI \(500 files\) and Backstage UI \(`@backstage\/ui`, 164 files\), and also Agenta UI \(40 files\)\./);
});

test('a repo with no colours to speak of still gets the two-kit rule', () => {
  const h = structuredClone(loadHarvest('twokits'));
  h.tokens.colors = []; h.tokens.tokenFile = null;
  assert.match(rulesMarkdown(h).text, /- This repo uses two kits: /);
});
const harvests = new Map();
function loadHarvest(fixture) {
  if (harvests.has(fixture)) return harvests.get(fixture);
  const tmp = mkdtempSync(join(tmpdir(), 'roast-twokits-h-'));
  execFileSync(process.execPath, [join(ENGINE, 'harvest/index.mjs'), join(FIX, fixture), '--out', join(tmp, 'h.json')], { stdio: 'ignore' });
  const h = JSON.parse(readFileSync(join(tmp, 'h.json'), 'utf8'));
  rmSync(tmp, { recursive: true, force: true });
  harvests.set(fixture, h);
  return h;
}

// ---------- the fix prompts ----------
test('a fix prompt for a kit move keeps the first kit off the second kit', () => {
  const base = { title: 't', sub: 's', deltaText: '', repoName: 'r', kit: 'Ant Design' };
  const second = { name: 'SigNoz UI', pkg: '@signozhq/ui' };
  const P1 = '- This repo also uses SigNoz UI (@signozhq/ui). Make these changes only on Ant Design components and the wrappers around them. On SigNoz UI components, copy how nearby files style them.';
  // inline styles are repo-wide: plain elements and other files stay in scope
  const P1i = "- This repo also uses SigNoz UI (@signozhq/ui). On SigNoz UI components, move a style the way nearby files do. Never put one kit's styling on the other's components.";
  const lastHow = (p) => p.split('\n\nWork through')[0].split('\n').at(-1);
  for (const metric of ['kitColour', 'kitPx']) assert.equal(lastHow(fixPrompt({ ...base, metric, second })), P1, metric);
  assert.equal(lastHow(fixPrompt({ ...base, metric: 'inlineStyles', second })), P1i);
  assert.doesNotMatch(fixPrompt({ ...base, metric: 'inlineStyles', second }), /only on Ant Design components/);
  for (const metric of ['important', 'nearPairs', 'colors']) assert.doesNotMatch(fixPrompt({ ...base, metric, second }), /also uses SigNoz/, metric);
  for (const metric of ['kitColour', 'kitPx', 'inlineStyles', 'important']) assert.equal(fixPrompt({ ...base, metric, second: null }), fixPrompt({ ...base, metric }), metric);
  // nothing claims what the first kit's tools cannot do: Linode wraps
  // Akamai components in MUI's styled() (2026-10-01)
  for (const metric of ['kitColour', 'kitPx', 'inlineStyles']) assert.doesNotMatch(fixPrompt({ ...base, metric, second }), /do not reach/);
});

// ---------- the MCP context ----------
test('the MCP context names both kits and says whose advice is whose', () => {
  const k = loadKnowledge(join(FIX, 'twokits'));
  const ctx = getContext(k);
  const lines = ctx.split('\n');
  const at = lines.findIndex((l) => l.startsWith('KITS: '));
  assert.equal(lines[at], "KITS: two in use. MUI (35 files) and Backstage UI (14 files in src/plugins). 3 files use both. Follow the kit the file already uses. Never put one kit's styling on the other's components. In a new file, use the kit the nearby files use.");
  assert.match(lines[at + 1], /^ {2}On MUI components: a colour, a spacing step or a radius is decided in src\/theme\/theme\.ts\./);
  assert.equal(lines[at + 2], '  Already written onto components in MUI files: 12 colours (#667085, #3355ff) and 13 pixel sizes; do not add more.');
  assert.equal(lines[at + 3], '  On Backstage UI components (@backstage/ui): copy how nearby files style them.');
  assert.ok(lines.includes('SPACING on MUI components: Use spacing steps (p: 2), not pixels.'));
  assert.doesNotMatch(ctx, FORBIDDEN);
  assert.doesNotMatch(ctx, /do not reach/);
  assert.ok(approxTokens(ctx) <= 400);
  // the bigger kit is named first, whichever it is
  const big = getContext({ ...k, kit: { ...k.kit, second: { ...k.kit.second, files: 500 } } });
  assert.match(big, /^KITS: two in use\. Backstage UI \(500 files in src\/plugins\) and MUI \(35 files\)/m);
  // a third kit is named too
  const three = getContext({ ...k, kit: { ...k.kit, alsoSeen: [{ name: 'Agenta UI', files: 20 }] } });
  assert.match(three, /^KITS: three in use\. MUI \(35 files\), Backstage UI \(14 files in src\/plugins\) and Agenta UI \(20 files\)\. 3 files use both\./m);
  assert.match(findToken(k, { value: '#667085' }), / That is for MUI components\. On Backstage UI components, copy how nearby files set colour\.$/);
  assert.match(findToken(k, { value: '12px' }), / That is for MUI components\. On Backstage UI components, copy how nearby files set sizes\.$/);
  // an answer that is not the kit's advice gets no kit note
  const bare = { ...k, tokenColorRgb: [] };
  assert.doesNotMatch(findToken(bare, { value: '#123456' }), /That is for/);
  // one kit: no such lines
  const one = loadKnowledge(join(FIX, 'muikit'));
  assert.doesNotMatch(getContext(one), /KITS:|On Backstage/);
  assert.doesNotMatch(findToken(one, { value: '12px' }), /That is for/);
});

test('with two kits the context fits its budget and keeps the kits, DISCIPLINE and the closing line', () => {
  const k = loadKnowledge(join(FIX, 'twokits'));
  const gap = (n, r = 4) => ({ title: `Gap number ${n} ${'with a long title '.repeat(r)}`, fix: 'Do the thing once and point every use at it. '.repeat(r) });
  // a little over: the first thing to go is the NOTE, and the GAP line stays
  let r = 1;
  while (r < 30 && /^NOTE: /m.test(getContext({ ...k, gaps: [gap(1, r)] }))) r++;
  const s = getContext({ ...k, gaps: [gap(1, r)] });
  assert.ok(r < 30, 'the NOTE never had to go');
  assert.ok(s.length <= 1600, `${s.length} characters`);
  assert.match(s, /^GAP: gap number 1/m);
  assert.doesNotMatch(s, /trimmed to budget/);
  // far over: still under budget, still holding the lines that matter
  const big = { ...k, gaps: [gap(1), gap(2), gap(3)] };
  const t = getContext(big);
  assert.ok(t.length <= 1600, `${t.length} characters`);
  assert.ok(approxTokens(t) <= 400);
  assert.match(t, /^KITS: two in use\./m);
  assert.match(t, /^ {2}On Backstage UI components/m);
  assert.match(t, /^DISCIPLINE: /m);
  assert.match(t, /^Before finishing: call roast_validate/m);
  assert.doesNotMatch(t, /^NOTE: /m);
  // past every drop (a very long theme path): the middle is cut, never the
  // KITS lines, DISCIPLINE or the closing line
  const long = { ...k, gaps: [gap(1), gap(2)], kit: { ...k.kit, themeFiles: [`src/${'very-long-folder-name/'.repeat(30)}theme.ts`] } };
  const u = getContext(long);
  assert.ok(u.length <= 1600, `${u.length} characters`);
  assert.match(u, /^KITS: two in use\./m);
  assert.match(u, /trimmed to budget/);
  assert.match(u, /\nDISCIPLINE: [^\n]+\nBefore finishing: call roast_validate[^\n]+$/);
});

// ---------- the live checks ----------
const muiKit = () => loadKnowledge(join(FIX, 'muikit'));
const findingsOf = (code, k = muiKit()) => validateContent({ text: code, file: 'src/components/New.tsx' }, k).findings;

test("a value on another kit's component gets that kit's name and a neutral fix, as a warning", () => {
  const code = "import Box from '@mui/material/Box';\nimport { TableCell } from '@akamai/cds-components/react/Table';\nexport const X = () => <TableCell style={{ paddingLeft: '58px' }} />;";
  const kit = findingsOf(code).filter((f) => f.rule.startsWith('kit-'));
  assert.equal(kit.length, 1);
  // a colour too
  const colour = findingsOf(code.replace("paddingLeft: '58px'", "color: '#ff0000'")).find((f) => f.rule === 'kit-colour');
  assert.equal(colour.severity, 'warning');
  assert.equal(colour.message, 'Colour #ff0000 written onto an Akamai CDS component (@akamai/cds-components/react/Table), in a file that also uses MUI.');
  assert.doesNotMatch(colour.fix, /\bsx\b|theme/);
  assert.equal(kit[0].rule, 'kit-px');
  assert.equal(kit[0].severity, 'warning');
  assert.match(kit[0].message, /an Akamai CDS component \(@akamai\/cds-components\/react\/Table\)/);
  assert.match(kit[0].message, /also uses MUI\./);
  assert.match(kit[0].fix, /Never put one kit's styling on the other's components/);
  assert.doesNotMatch(kit[0].fix, /\bsx\b|step/);
});

test("the first kit's own elements keep the first kit's words", () => {
  const code = "import Box from '@mui/material/Box';\nimport { CloseOutlined } from '@ant-design/icons';\nimport { Paper } from '@filigran/design-system';\nexport const X = () => <Box sx={{ p: '12px' }}><div style={{ padding: '13px' }}><CloseOutlined style={{ color: '#ff0000' }} /><Paper /></div></Box>;";
  const kit = findingsOf(code).filter((f) => f.rule.startsWith('kit-'));
  assert.equal(kit.length, 3);
  assert.ok(kit.every((f) => f.severity === 'violation'));
  assert.ok(kit.every((f) => /an MUI component/.test(f.message)));
  assert.match(kit.find((f) => f.message.includes('p: 12px')).fix, /step 3/);
});

test('Ant Design: a SigNoz UI callout is named, and the token advice stays off it', () => {
  const kit = { name: 'Ant Design', def: KITS['Ant Design'], themeFiles: [], themeValues: [], layers: [] };
  const code = "import { Button } from 'antd';\nimport { Callout } from '@signozhq/ui/callout';\nexport const X = () => <><Button style={{ marginTop: 12 }} /><Callout style={{ marginTop: 12 }} /></>;";
  const { findings } = kitPaintFindings(code, kit, { file: 'src/x.tsx' });
  const [onButton, onCallout] = findings;
  assert.match(onButton.fix, /token\.margin/);
  assert.equal(onCallout.label, 'pixel size on a SigNoz UI component');
  assert.equal(onCallout.note, 'it comes from @signozhq/ui/callout, not Ant Design');
  assert.equal(onCallout.message, 'Pixel size marginTop: 12px on a SigNoz UI component (@signozhq/ui/callout), in a file that also uses Ant Design.');
  assert.doesNotMatch(onCallout.fix, /token\./);
});

test('the element is found through styled(), a namespace import and a prop holding JSX', () => {
  const styledOther = "import { styled } from '@mui/material/styles';\nimport { Paper } from '@filigran/design-system';\nexport const P = styled(Paper)({ padding: '13px' });";
  assert.match(findingsOf(styledOther).find((f) => f.rule === 'kit-px').message, /a Filigran Design System component/);
  const ns = "import Box from '@mui/material/Box';\nimport * as Cds from '@akamai/cds-components/react/Table';\nexport const X = () => <Cds.TableCell style={{ marginTop: '10px' }} />;";
  assert.match(findingsOf(ns).find((f) => f.rule === 'kit-px').message, /an Akamai CDS component/);
  const nested = "import Box from '@mui/material/Box';\nimport { Callout } from '@signozhq/ui/callout';\nexport const X = () => <Callout title={<Box sx={{ p: '13px' }}>t</Box>} style={{ marginTop: '12px' }} />;";
  const f = findingsOf(nested).filter((x) => x.rule === 'kit-px');
  assert.match(f.find((x) => x.message.includes('p: 13px')).message, /an MUI component/);
  assert.match(f.find((x) => x.message.includes('marginTop: 12px')).message, /a SigNoz UI component/);
});

test('the element finder holds up against the shapes the review found', () => {
  const M = "import Box from '@mui/material/Box';\nimport { styled } from '@mui/material/styles';\n";
  const kitOf = (code) => findingsOf(code).filter((f) => f.rule.startsWith('kit-')).map((f) => (f.message.match(/on(?:to)? an? (.+?) component/) ?? [])[1]);
  const fil = "import { Paper } from '@filigran/design-system';\nconst A = styled(Paper)({ margin: 0 });\n";
  // after a styled(OtherKit) call, a later styled('div'), styled.div or plain object is not the other kit's
  assert.deepEqual(kitOf(`${M}${fil}const B = styled('div')({ padding: '13px' });`), ['MUI']);
  assert.deepEqual(kitOf(`${M}${fil}const B = styled.div({ padding: '13px' });`), ['MUI']);
  assert.deepEqual(kitOf(`${M}${fil}const s = { padding: '13px' };\nexport const X = () => <Box sx={s} />;`), ['MUI']);
  // inside the styles handed to styled(OtherKit), with options and a type argument
  assert.deepEqual(kitOf(`${M}import { Paper } from '@filigran/design-system';\nconst A = styled(Paper, { shouldForwardProp: (p) => p !== 'x' })<{ x: boolean }>(({ theme }) => ({ padding: '13px' }));`), ['Filigran Design System']);
  // a quoted > and a type argument on the tag do not close it
  const sel = "import { Select } from '@akamai/cds-components';\n";
  assert.deepEqual(kitOf(`${M}${sel}export const X = () => <Box><Select title="Settings > Region" style={{ marginTop: '12px' }} /></Box>;`), ['Akamai CDS']);
  assert.deepEqual(kitOf(`${M}${sel}export const X = () => <Box><Select<Option> value={v} style={{ marginTop: '12px' }} /></Box>;`), ['Akamai CDS']);
  // a style built inside a render prop is not on the prop's owner
  const cal = "import { Callout } from '@signozhq/ui/callout';\n";
  assert.deepEqual(kitOf(`${M}${cal}export const X = () => <Callout renderAction={() => { const s = { color: '#123456', p: '13px' }; return <Box sx={s} />; }} />;`), ['MUI', 'MUI']);
  assert.deepEqual(kitOf(`${M}${cal}export const X = () => <Callout icon={<Box title="Settings > Profile" sx={{ color: '#123456' }} />} />;`), ['MUI']);
  // a side-effect import first, and require()
  assert.deepEqual(kitOf(`import './x.css';\n${M}import Callout from '@signozhq/ui/callout';\nexport const X = () => <Callout style={{ color: '#123456' }} />;`), ['SigNoz UI']);
  assert.deepEqual(kitOf("const Box = require('@mui/material/Box');\nconst { TableCell } = require('@akamai/cds-components/react/Table');\nexport const X = () => <Box><TableCell style={{ paddingLeft: '58px' }} /></Box>;"), ['Akamai CDS']);
});

test('every value in a mixed file is said once, by the kit rule, as the count reads it', () => {
  const code = "import Box from '@mui/material/Box';\nimport { TableCell } from '@akamai/cds-components/react/Table';\nexport const X = () => <Box sx={{ p: '12px', color: '#667085' }}><TableCell style={{ paddingLeft: '58px', color: '#ff0000' }} /></Box>;";
  const all = findingsOf(code);
  const hits = kitPaintInSource(code, KITS.MUI, { file: 'src/components/New.tsx' });
  assert.equal(all.filter((f) => f.rule.startsWith('kit-')).length, hits.colours.length + hits.px.length);
  assert.ok(!all.some((f) => f.rule === 'hardcoded-colour' || f.rule === 'off-scale-spacing'));
});

test("the guard's doorway words an other-kit line as the live check does", () => {
  const sys = api.learnSystem(join(FIX, 'muikit'));
  const code = "import Box from '@mui/material/Box';\nimport { TableCell } from '@akamai/cds-components/react/Table';\nexport const X = () => <TableCell style={{ paddingLeft: '58px' }} />;";
  const door = api.kitPaintFindings(code, sys.profile.kit, { file: 'src/components/New.tsx' }).findings.map((f) => `${f.rule}|${f.message}|${f.fix}`);
  const live = findingsOf(code).filter((f) => f.rule.startsWith('kit-')).map((f) => `${f.rule}|${f.message}|${f.fix}`);
  assert.deepEqual(door, live);
});

test('the edit hook says an other-kit warning once, and the end-of-turn review leaves it out', () => {
  const dir = mkdtempSync(join(tmpdir(), 'roast-twokits-hook-'));
  cpSync(join(FIX, 'twokits'), dir, { recursive: true });
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  git('init', '-q'); git('add', '-A'); git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init');
  const session = `twokits-${process.pid}-${Math.random().toString(36).slice(2)}`;
  const run = (args, input) => spawnSync(process.execPath, [BIN, ...args], { cwd: dir, input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ROAST_STOP_REVIEW: '' } });
  const ev = (tool) => ({ cwd: dir, tool_name: tool, hook_event_name: 'PostToolUse', session_id: session, tool_input: { file_path: join(dir, 'src/plugins/Mixed4.tsx') } });
  try {
    run(['--session-start'], { cwd: dir, hook_event_name: 'SessionStart', session_id: session });
    writeFileSync(join(dir, 'src/plugins/Mixed4.tsx'), "import Box from '@mui/material/Box';\nimport { Card } from '@backstage/ui';\nexport const M4 = () => <Box sx={{ p: 2 }}><Card style={{ margin: '14px' }}>x</Card></Box>;\n");
    const first = JSON.parse(run(['--hook'], ev('Write')).stdout).hookSpecificOutput.additionalContext;
    assert.match(first, /Pixel size margin: 14px on a Backstage UI component \(@backstage\/ui\), in a file that also uses MUI\./);
    writeFileSync(join(dir, 'src/plugins/Mixed4.tsx'), `${readFileSync(join(dir, 'src/plugins/Mixed4.tsx'), 'utf8')}// touched\n`);
    const again = run(['--hook'], ev('Edit')).stdout;
    assert.doesNotMatch(again, /Backstage UI component/);
    // the inline style is a violation and is sent back; the other-kit line is not
    const stop = run(['--stop-hook'], { cwd: dir, hook_event_name: 'Stop', stop_hook_active: false, session_id: session }).stdout;
    assert.doesNotMatch(stop, /Backstage UI component/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    for (const f of readdirSync(tmpdir()).filter((x) => x.includes(session))) rmSync(join(tmpdir(), f), { force: true, recursive: true });
  }
});

// ---------- a shadcn catalogue one folder down (nhost) ----------
test('a nested shadcn catalogue outweighs a smaller kit', () => {
  const build = (importPath, n) => {
    const root = tempRepo({}, join(FIX, 'shadcnfresh'));
    mkdirSync(join(root, 'components/ui/v3'), { recursive: true });
    for (const f of readdirSync(join(root, 'components/ui')).filter((x) => x.endsWith('.tsx'))) renameSync(join(root, 'components/ui', f), join(root, 'components/ui/v3', f));
    const cj = JSON.parse(readFileSync(join(root, 'components.json'), 'utf8'));
    cj.aliases.ui = '@/components/ui/v3';
    write(root, {
      'components.json': JSON.stringify(cj, null, 2),
      'package.json': JSON.stringify({ ...JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')), dependencies: { ...JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).dependencies, '@mui/material': '^5.0.0' } }),
      ...many(35, (i) => `admin/M${i}.tsx`, muiFile),
      ...many(n, (i) => `app/pages/P${i}.tsx`, (i) => `import { Button } from '${importPath}';\nexport const P${i} = () => <Button>p</Button>;\n`),
    });
    return root;
  };
  const kindOf = (importPath, n) => { const root = build(importPath, n); try { const p = profileOfRepo(root); return { kind: p.kind, uiDirs: p.uiDirs ?? [], rules: p }; } finally { rmSync(root, { recursive: true, force: true }); } };
  const nested = kindOf('@/components/ui/v3/button', 40);
  assert.equal(nested.kind, 'shadcn');
  assert.ok(nested.uiDirs.some((d) => d.endsWith('components/ui/v3')), JSON.stringify(nested.uiDirs));
  // an MUI layer one folder down (components/ui/v2/Button) is not a shadcn import
  assert.equal(kindOf('@/components/ui/v2/Button', 40).kind, 'mui');
  // fewer catalogue files than kit files: still the kit
  assert.equal(kindOf('@/components/ui/v3/button', 10).kind, 'mui');
  // the team's own kebab-case wrappers one folder down are not shadcn's
  assert.equal(kindOf('@/components/ui/forms/text-field', 40).kind, 'mui');
});

// ---------- copy ----------
test('the new words have no em dash and say colour', () => {
  for (const f of ['lib/kitlist.mjs', 'lib/kitpaint.mjs', 'profiles/kit-common.mjs', 'rules/build.mjs', 'lib/fixprompt.mjs', 'mcp/tools.mjs', 'diagnose/index.mjs']) {
    const src = readFileSync(join(ENGINE, f), 'utf8');
    for (const line of src.split('\n').filter((l) => /two kits|second kit|other kit|other's components|also uses|files around them|not scored|do not reach them|Two kits/i.test(l))) {
      assert.doesNotMatch(line, /—/, `${f}: ${line.trim().slice(0, 80)}`);
      assert.doesNotMatch(line.replace(/\b(?:colorText\w*|bgcolor|color:|color=|colors-generator|token\.color\w*)/g, ''), /\bcolor\b/, `${f}: ${line.trim().slice(0, 80)}`);
    }
  }
});
