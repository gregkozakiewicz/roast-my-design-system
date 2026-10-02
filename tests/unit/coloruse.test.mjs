// The colour-use bar (harvest/coloruse.mjs, 9.7.0): what a use is, which
// state it is drawn in, and which files and statements are left out. Each
// test builds a small repo in a temp folder and reads it as the harvest does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { colourUse } from '../../skills/roast-my-design-system/scripts/harvest/coloruse.mjs';
import { harvestTokens } from '../../skills/roast-my-design-system/scripts/harvest/tokens.mjs';
import { paletteFindings } from '../../skills/roast-my-design-system/scripts/lib/palette.mjs';
import { canonical } from '../../skills/roast-my-design-system/scripts/lib/color.mjs';

const STYLE_RE = /\.(css|scss|sass|less)$/;
function run(fileMap, opts = {}) {
  const root = mkdtempSync(join(tmpdir(), 'roast-use-'));
  try {
    for (const [f, body] of Object.entries(fileMap)) {
      mkdirSync(join(root, dirname(f)), { recursive: true });
      writeFileSync(join(root, f), body);
    }
    const names = Object.keys(fileMap);
    const files = { styles: names.filter((f) => STYLE_RE.test(f)), code: names.filter((f) => /\.[mc]?[jt]sx?$/.test(f)), other: [] };
    const tokens = harvestTokens(root, files.styles, files.code);
    return colourUse(root, files, tokens, opts);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
const byCanon = (u, value, state = null) => u.segments.find((s) => s.canon === canonical(value) && (!state || s.state === state));
const byName = (u, name, state = null) => u.segments.find((s) => s.names.includes(name) && (!state || s.state === state));
const SHADCN = { source: 'shadcn', file: 'app.css', names: ['primary'], values: {}, retuned: [], families: null, doors: { uiDirs: [], shadcn: { blockFiles: [] } } };
// enough of the repo's own uses that shadcn's components stay out
const OWN = `<p className="${'text-ink '.repeat(25)}" />`;
const INK = { 'ink.css': '@theme { --color-ink: #222222; }' };

test('a theme class takes the :root value; the .dark value and a dark theme file are ignored', () => {
  const u = run({
    'a-dark.css': ':root { --primary: #ddeeff; }',
    'app.css': '@theme inline { --color-primary: var(--primary); }\n:root { --primary: #112233; }\n.dark { --primary: #aabbcc; }',
    'page.tsx': '<div className="bg-primary" />',
  });
  const s = byCanon(u, '#112233', 'token');
  assert.ok(s, JSON.stringify(u.segments));
  assert.equal(s.classes, 1);
  assert.ok(!byCanon(u, '#aabbcc') && !byCanon(u, '#ddeeff'));
});

test("a package's own v3 config beats another package's --color-NAME, and a name defined nowhere is dead, not drawn", () => {
  const u = run({
    'apps/web/package.json': '{"name":"web"}',
    'apps/web/theme.css': '@theme { --color-primary: #0f172a; }',
    'packages/ui/package.json': '{"name":"ui"}',
    'packages/ui/tailwind.config.js': "module.exports = { theme: { extend: { colors: { primary: 'var(--primary)' } } } };",
    'packages/ui/sheet.css': ':root { --primary: oklch(0.205 0 0); }',
    'packages/ui/card.tsx': '<div className="bg-primary text-nowhere-ink" />',
  });
  assert.equal(byCanon(u, 'oklch(0.205 0 0)', 'token')?.classes, 1);
  assert.ok(!byCanon(u, '#0f172a', 'token'));
  assert.deepEqual(u.deadNames.top, [['nowhere-ink', 1]]);
  assert.ok(!u.segments.some((s) => s.names.includes('nowhere-ink')));
});

test('an opacity modifier and a variant are uses of the colour; a theme mapping is not a use', () => {
  const u = run({
    'app.css': '@theme inline { --color-primary: var(--primary); }\n:root { --primary: #112233; }',
    'page.tsx': '<div className="bg-primary/50 hover:bg-primary dark:bg-zinc-900" />',
  });
  assert.equal(byCanon(u, '#112233', 'token').classes, 2);
  assert.equal(byName(u, 'zinc-900').palette, 1);
  assert.equal(u.totals.vars, 0);
});

test('palette classes follow the one palette rule', () => {
  // rule off: the palette
  assert.equal(run({ 'a.tsx': '<p className="bg-blue-500" />' }).segments[0].state, 'palette');
  // a family the theme lacks: the palette; one it has: a stray
  const fam = { ...SHADCN, source: 'tailwind', families: { grey: false, colour: true } };
  const f = run({ 'a.tsx': '<p className="text-gray-500 text-blue-500" />' }, { palette: fam });
  assert.equal(byName(f, 'gray-500').state, 'palette');
  assert.equal(byName(f, 'blue-500').state, 'stray');
  // plain white is the palette; a hand-written dark: white on a shadcn sheet is a stray
  const w = run({ 'a.tsx': '<p className="bg-white dark:bg-white" />' }, { palette: SHADCN });
  assert.equal(byName(w, 'white', 'palette').palette, 1);
  assert.equal(byName(w, 'white', 'stray').palette, 1);
  // a palette name the theme gave its own colour is the theme
  const r = run({ 'app.css': '@theme { --color-gray-100: #f0f0f0; }', 'a.tsx': '<p className="bg-gray-100" />' }, { palette: { ...SHADCN, source: 'tailwind', retuned: ['gray-100'] } });
  assert.equal(byCanon(r, '#f0f0f0', 'token').classes, 1);
  // an @apply line is the palette: the rule leaves stylesheets alone
  const a = run({ 'app.css': '.x { @apply bg-blue-500; }', 'a.tsx': '<p />' }, { palette: SHADCN });
  assert.equal(byName(a, 'blue-500').state, 'palette');
  assert.equal(a.paletteWhy.apply, 1);
});

test("shadcn's own components and demo folders are not counted", () => {
  const P = { isShadcn: true, uiDirs: ['components/ui'], shadcn: { blockFiles: [] } };
  const u = run({
    ...INK, 'own.tsx': OWN,
    'components/ui/button.tsx': '<button className="bg-blue-500" />',
    'stories/button.stories.tsx': '<div className="bg-blue-600" />',
  }, { P, palette: SHADCN });
  assert.equal(u.scope, 'own');
  assert.equal(u.doorFiles, 1);
  assert.ok(!byName(u, 'blue-500') && !byName(u, 'blue-600'));
});

test("with almost nothing of its own, shadcn's components are counted and the scope says so", () => {
  const P = { isShadcn: true, uiDirs: ['components/ui'], shadcn: { blockFiles: [] } };
  const u = run({ 'app.css': '@theme { --color-primary: #112233; }', 'page.tsx': '<p />', 'components/ui/button.tsx': '<button className="bg-primary bg-blue-500" />' }, { P, palette: SHADCN });
  assert.equal(u.scope, 'installed');
  assert.equal(byCanon(u, '#112233', 'token').classes, 1);
  // inside shadcn's own components the rule judges nothing: the palette
  assert.equal(byName(u, 'blue-500').state, 'palette');
});

test("a token's value written by hand is a stray; definitions in a sheet, a config and a css`` block are not uses", () => {
  const u = run({
    'theme.css': ':root { --brand: #ff0055; }\n.x { color: #ff0055; }',
    'tailwind.config.js': "module.exports = { theme: { colors: { accent: '#00aa55' } } };",
    'el.styles.ts': 'export const styles = css`:host { --lit-bg: #123456; } .a { color: var(--lit-bg); }`;',
    'a.tsx': '<p />',
  });
  const pasted = byCanon(u, '#ff0055', 'stray');
  assert.equal(pasted.written, 1);
  assert.equal(pasted.token, true);
  assert.deepEqual(pasted.names, ['--brand']);
  assert.ok(!byCanon(u, '#00aa55'));
  assert.equal(byCanon(u, '#123456', 'token').vars, 1);
  assert.ok(!byCanon(u, '#123456', 'stray'));
});

test('var() in code, bg-[--x] and bg-(--x) are all reads of --x', () => {
  const u = run({ 'theme.css': ':root { --x: #abcdef; }', 'a.tsx': '<p style={{ color: "var(--x)" }} className="bg-[--x] bg-(--x) border-[var(--x)]" />' });
  assert.equal(byCanon(u, '#abcdef', 'token').vars, 4);
});

test("kit reads: the mode and inherit are not colours, antd-style's cssVar is", () => {
  const mui = run({ 'a.tsx': "const c = theme.palette.mode === 'dark' ? theme.palette.text.primary : theme.palette.getContrastText(x);" }, { kit: 'MUI' });
  assert.equal(mui.totals.kit, 1);
  assert.equal(byName(mui, 'text.primary').named, 'kit');
  const mantine = run({ 'a.tsx': '<Text c="inherit" /><Text c="dimmed" />' }, { kit: 'Mantine' });
  assert.equal(mantine.totals.kit, 1);
  const antd = run({ 'a.tsx': 'const s = css`color: ${cssVar.colorText};`; const t = token.colorPrimary;' }, { kit: 'Ant Design' });
  assert.equal(antd.totals.kit, 2);
});

test('the bar calls a palette class a stray exactly where the live check flags it', () => {
  const text = '<div className="text-gray-500 hover:bg-blue-100 bg-white dark:bg-black border-t-gray-200 bg-zinc-50/50" />';
  const u = run({ 'a.tsx': text }, { palette: SHADCN });
  const flagged = paletteFindings(text, SHADCN, { file: 'a.tsx' }).length;
  assert.equal(u.totals.paletteStray, flagged);
  assert.equal(u.totals.palette, 2); // plain white, a side border
});

test('the weights add up, and the token share is the share reached by name', () => {
  const hexes = Array.from({ length: 70 }, (_, i) => `#${(0x100000 + i * 4099).toString(16).slice(-6)}`);
  const u = run({
    'theme.css': `:root { --a: #111111; }\n${hexes.map((h, i) => `.c${i} { color: ${h}; }`).join('\n')}`,
    'a.tsx': '<p style={{ color: "var(--a)" }} className="bg-blue-500" />',
  });
  assert.ok(u.rest.stray.count > 0);
  const drawn = u.segments.reduce((n, s) => n + s.weight, 0) + u.rest.token.weight + u.rest.palette.weight + u.rest.stray.weight;
  assert.equal(drawn, u.totals.total);
  const T = u.totals;
  assert.equal(u.share.token, (T.classes + T.vars + T.kit + T.outside) / T.total);
});

test('the bar keeps written values when a fifth of colour uses read a theme it cannot follow', () => {
  const uses = '<p className="bg-blue-500" />'.repeat(10);
  const over = run({ 'a.scss': '.a { color: $primary; }\n.b { background: $surface; }\n.c { border-color: $edge; }', 'a.tsx': uses });
  assert.deepEqual(over.fallback?.why, ['sass']);
  const under = run({ 'a.scss': '.a { color: $primary; }\n.b { background: $surface; }', 'a.tsx': uses });
  assert.equal(under.fallback, null);
});

// ---------- 9.7.0 review: what each fix pins ----------

test('a dark at-rule stated first does not win over the light :root', () => {
  const u = run({ 'app.css': '@media (prefers-color-scheme: dark) { :root { --primary: #010101; } }\n:root { --primary: #fefefe; }\n@theme inline { --color-primary: var(--primary); }', 'a.tsx': '<p className="bg-primary" />' });
  assert.equal(byCanon(u, '#fefefe', 'token')?.classes, 1);
});

// 9.7.1: documenso's `:root, .dark-mode-disabled` was ranked dark for the
// word in its second selector; a list with a bare root in it is root
test('a selector list headed by :root is a root statement whatever follows it', () => {
  const u = run({ 'app.css': '.dark:not(.dark-mode-disabled) { --primary: #010101; }\n:root,\n.dark-mode-disabled { --primary: #fefefe; }\n@theme inline { --color-primary: var(--primary); }', 'a.tsx': '<p className="bg-primary" />' });
  assert.equal(byCanon(u, '#fefefe', 'token')?.classes, 1);
});

test('a light statement under a plain selector beats a .dark one stated first', () => {
  const u = run({ 'app.css': '.dark { --primary: #010101; }\n.theme { --primary: #fefefe; }\n@theme inline { --color-primary: var(--primary); }', 'a.tsx': '<p className="bg-primary" />' });
  assert.equal(byCanon(u, '#fefefe', 'token')?.classes, 1);
});

test('a var() read in a package takes its own --x before another package', () => {
  const u = run({
    'a/package.json': '{}', 'a/x.css': ':root { --ink: #111111; }',
    'b/package.json': '{}', 'b/x.css': ':root { --ink: #222222; }', 'b/p.tsx': '<p style={{ color: "var(--ink)" }} />',
  });
  assert.equal(byCanon(u, '#222222', 'token')?.vars, 1);
  assert.ok(!byCanon(u, '#111111', 'token'));
});

// The bare --NAME step, as it behaves (coloruse.mjs header): in the use's
// own package only where the package keeps no @theme and no config; across
// every package, whatever the package keeps.
test('a bare --NAME answers a class in a package with no @theme and no config, before another package\'s --color-NAME', () => {
  const v3 = run({ 'pkg/package.json': '{}', 'pkg/s.css': ':root { --ink: #123456; }', 'pkg/p.tsx': '<p className="text-ink" />' });
  assert.equal(byCanon(v3, '#123456', 'token')?.classes, 1);
  const two = run({
    'pkg/package.json': '{}', 'pkg/s.css': ':root { --ink: #123456; }', 'pkg/p.tsx': '<p className="text-ink" />',
    'other/package.json': '{}', 'other/t.css': '@theme { --color-ink: #654321; }',
  });
  assert.equal(byCanon(two, '#123456', 'token')?.classes, 1);
  assert.ok(!byCanon(two, '#654321', 'token'));
});

test("in a package with a theme of its own, another package's --color-NAME comes before the package's bare --NAME", () => {
  const u = run({
    'pkg/package.json': '{}', 'pkg/s.css': '@theme { --color-brand: #0000ff; }\n:root { --ink: #123456; }', 'pkg/p.tsx': '<p className="text-ink bg-brand" />',
    'other/package.json': '{}', 'other/t.css': '@theme { --color-ink: #654321; }',
  });
  assert.equal(byCanon(u, '#654321', 'token')?.classes, 1);
  assert.ok(!byCanon(u, '#123456', 'token'));
});

test('a package with a theme still reads a bare --NAME when no --color-NAME and no config anywhere names the class', () => {
  const u = run({ 'pkg/package.json': '{}', 'pkg/s.css': '@theme { --color-brand: #0000ff; }\n:root { --muted: #eeeeee; }', 'pkg/p.tsx': '<p className="bg-muted bg-brand" />' });
  assert.equal(byCanon(u, '#eeeeee', 'token')?.classes, 1);
  assert.equal(u.deadNames.count, 0);
});

test('JavaScript theme reads trigger the fallback', () => {
  const u = run({ 'a.tsx': `${'const c = theme.colors.textSecondary;\n'.repeat(5)}<p className="${'bg-blue-500 '.repeat(10)}" />` });
  assert.deepEqual(u.fallback?.why, ['js-theme']);
});

test('the tail beyond 60 colours is split by state', () => {
  const hexes = Array.from({ length: 62 }, (_, i) => `#${(0x100000 + i * 4099).toString(16).slice(-6)}`);
  const u = run({ 'theme.css': `:root { ${hexes.map((h, i) => `--t${i}: ${h};`).join(' ')} }\n.z { color: #abcdef; } .y { color: #fedcba; }`, 'a.tsx': `<p style={{ color: "${hexes.map((_, i) => `var(--t${i})`).join(' ')}" }} />` });
  assert.equal(u.segments.length, 60);
  assert.ok(u.rest.token.count > 0);
  assert.equal(u.rest.token.named.count, 0);
});

test('a stylesheet under stories/ is not counted', () => {
  const u = run({ 'app.css': ':root { --ink: #121212; }', 'stories/x.css': '.a { color: var(--ink); }', 'a.tsx': '<p />' });
  assert.equal(u.totals.vars, 0);
});

test("MUI's mode, its helpers and a bare theme.palette are not colour reads, so they send no bar to the fallback", () => {
  const reads = "const dark = theme.palette.mode === 'dark';\nconst p = theme.palette;\nconst t = theme.palette.getContrastText(x);\nconst a = theme.palette.augmentColor(y);\n".repeat(5);
  const uses = '<p className="bg-blue-500" />'.repeat(10);
  const mui = run({ 'a.tsx': `${reads}const c = theme.palette.text.primary;\n${uses}` }, { kit: 'MUI' });
  assert.equal(mui.unreadable.js, 0);
  assert.equal(mui.fallback, null);
  // outside a kit too (emotion reading an MUI-shaped theme)
  const plain = run({ 'a.tsx': `${reads}${uses}` });
  assert.equal(plain.unreadable.js, 0);
  assert.equal(plain.fallback, null);
});

test('a width in a border shorthand is not a Sass colour read', () => {
  const u = run({ 'a.scss': '.a { border: $app-border-width solid $app-border-colour; }\n.b { outline: $app-focus-width solid $app-focus-colour; }\n.c { box-shadow: 0 $app-shadow-offset $app-shadow-blur $app-shadow-colour; }\n.d { border-color: $app-border-width; }', 'a.tsx': '<p />' });
  // the three colours, and border-color reads its value whatever its name
  assert.equal(u.unreadable.sass, 4);
});

test('classes are read only where the repo shows Tailwind', () => {
  const files = { 'theme.css': ':root { --primary: #123456; }', 'a.tsx': '<p className="text-white bg-primary" />' };
  // Bootstrap's text-white and bg-primary paint through no Tailwind theme
  const none = run(files, { tailwind: false });
  assert.equal(none.totals.classes + none.totals.palette + none.totals.paletteStray, 0);
  assert.ok(!none.segments.some((s) => s.state === 'palette'));
  // a stylesheet bringing Tailwind in, or a config, is evidence enough
  const sheet = run({ ...files, 'theme.css': '@import "tailwindcss";\n:root { --primary: #123456; }' }, { tailwind: false });
  assert.equal(byName(sheet, 'white', 'palette')?.palette, 1);
  const v3 = run({ ...files, 'theme.css': '@tailwind base;\n:root { --primary: #123456; }' }, { tailwind: false });
  assert.equal(byName(v3, 'white', 'palette')?.palette, 1);
  const config = run({ ...files, 'tailwind.config.js': 'module.exports = {};' }, { tailwind: false });
  assert.equal(byName(config, 'white', 'palette')?.palette, 1);
});

test("in utility-class mode the own theme's retuned palette names are reached by name", () => {
  const files = { 'app.css': '@theme { --color-neutral-400: hsl(0 0% 60%); }', 'a.tsx': '<p className="text-neutral-400 bg-neutral-100" />' };
  const u = run(files, { palette: null, retuned: ['neutral-400'] });
  assert.equal(byCanon(u, 'hsl(0 0% 60%)', 'token')?.classes, 1);
  assert.equal(byName(u, 'neutral-100').state, 'palette');
});

test("a written stray names only a token whose daylight value is the same colour", () => {
  const u = run({
    'a-dark.css': ':root { --white: #15171a; }',
    'b.css': ':root { --white: #ffffff; --ink: #15171a; }\n.x { color: #15171a; }\n.y { color: #15171a; }',
  });
  const s = byCanon(u, '#15171a', 'stray');
  assert.equal(s.written, 2);
  assert.ok(!s.names.includes('--white'), JSON.stringify(s.names));
  assert.deepEqual(s.names, ['--ink']);
  // a dark-mode token's value with no daylight name left: the token flag stays
  const d = run({ 'a-dark.css': ':root { --white: #15171a; }', 'b.css': ':root { --white: #ffffff; }\n.x { color: #15171a; }' });
  assert.deepEqual(byCanon(d, '#15171a', 'stray').names, []);
  assert.equal(byCanon(d, '#15171a', 'stray').token, true);
});

test('"most in" names the file that writes the colour by hand, never one whose writes are all definitions', () => {
  const u = run({
    'theme.scss': `:root { ${Array.from({ length: 8 }, (_, i) => `--x${i}: #ffffff;`).join(' ')} }`,
    'cursor.ts': 'export const a = "#ffffff"; export const b = "#ffffff";',
  });
  const s = byCanon(u, '#ffffff', 'stray');
  assert.equal(s.written, 2);
  assert.equal(s.file, 'cursor.ts');
  // nothing written by hand in any listed file: no file named
  const only = run({ 'theme.css': ':root { --x: #abcdef; }\n:root { --y: #abcdef; }', 'b.css': '.q { color: #abcdef; }' });
  const o = byCanon(only, '#abcdef', 'stray');
  assert.equal(o.file, 'b.css');
});

test("a Tailwind preset's colours are the config's: a tailwind-config package, and one reached through presets: [require()]", () => {
  const u = run({
    'packages/tailwind-config/package.json': '{"name":"@acme/tailwind-config","main":"index.cjs"}',
    'packages/tailwind-config/index.cjs': "module.exports = { theme: { extend: { colors: { acme: { DEFAULT: '#66c622', 700: '#3d7a14' } } } } };",
    'packages/ui/package.json': '{"name":"@acme/ui"}',
    'packages/ui/tailwind.config.cjs': "const base = require('@acme/tailwind-config');\nmodule.exports = { presets: [base] };",
    'packages/ui/a.tsx': '<p className="bg-acme-700 text-acme" />',
  });
  assert.equal(byCanon(u, '#3d7a14', 'token')?.classes, 1);
  assert.equal(byCanon(u, '#66c622', 'token')?.classes, 1);
  assert.equal(u.deadNames.count, 0);
  const rel = run({
    'web/package.json': '{}',
    'web/brand-preset.js': "module.exports = { theme: { colors: { ocean: '#0077be' } } };",
    'web/tailwind.config.js': "module.exports = { presets: [require('./brand-preset')] };",
    'web/a.tsx': '<p className="bg-ocean" />',
  });
  assert.equal(byCanon(rel, '#0077be', 'token')?.classes, 1);
  // the preset's hex is a definition, never a stray
  assert.ok(!byCanon(rel, '#0077be', 'stray'));
  // a tailwind-config package is read even where no config names it
  const pkg = run({
    'tooling/tailwind-config/package.json': '{"name":"@acme/tw"}',
    'tooling/tailwind-config/base.js': "export default { theme: { colors: { dawn: '#f5a623' } } };",
    'web/package.json': '{}', 'web/a.tsx': '<p className="bg-dawn" />',
  });
  assert.equal(byCanon(pkg, '#f5a623', 'token')?.classes, 1);
});

test("white and black are counted apart, and a dark: override of either is its own stray", () => {
  const u = run({ 'a.tsx': '<p className="bg-white text-white text-black dark:bg-black dark:text-white" />' }, { palette: SHADCN });
  assert.equal(u.paletteWhy.white, 2);
  assert.equal(u.paletteWhy.black, 1);
  assert.equal(u.totals.paletteStrayDark, 2);
  assert.ok(u.segments.filter((s) => s.dark).every((s) => s.state === 'stray'));
  assert.equal(u.segments.filter((s) => s.dark).length, 2);
  // a flagged palette shade is a stray, not a dark: override
  const g = run({ 'a.tsx': '<p className="dark:bg-gray-900" />' }, { palette: SHADCN });
  assert.ok(!g.segments.some((s) => s.dark));
});

test("the token tail records how many of its colours are named without a swatch", () => {
  const reads = Array.from({ length: 70 }, (_, i) => `theme.palette.c${i}.main`).join('; ');
  const u = run({ 'a.tsx': `const x = () => { ${reads}; };` }, { kit: 'MUI' });
  assert.ok(u.rest.token.count > 0);
  assert.equal(u.rest.token.named.count, u.rest.token.count);
});

test("within one package, a --color-NAME comes before the config's NAME", () => {
  const u = run({
    'pkg/package.json': '{}',
    'pkg/app.css': '@theme { --color-primary: #101010; }',
    'pkg/tailwind.config.js': "module.exports = { theme: { extend: { colors: { primary: '#202020' } } } };",
    'pkg/a.tsx': '<p className="bg-primary" />',
  });
  assert.equal(byCanon(u, '#101010', 'token')?.classes, 1);
  assert.ok(!byCanon(u, '#202020', 'token'));
});

// ---------- 9.9.0: named colours, color-mix() and light-dark() ----------

test('a theme value written as a CSS colour name resolves to a swatch', () => {
  const u = run({ 'app.css': '@theme { --color-canvas: whitesmoke; }', 'a.tsx': '<p className="bg-canvas" />' });
  const s = byCanon(u, '#f5f5f5', 'token');
  assert.ok(s, JSON.stringify(u.segments));
  assert.equal(s.classes, 1);
});

test('a word that is not a colour name still paints nothing', () => {
  const u = run({ 'app.css': '@theme { --color-brand: brandish; }', 'a.tsx': '<p className="bg-brand" />' });
  assert.ok(!u.segments.some((s) => s.canon && s.names.includes('--color-brand')), JSON.stringify(u.segments));
});

test('color-mix() of two literals is mixed by weight', () => {
  const u = run({ 'app.css': '@theme { --color-tint: color-mix(in srgb, #000000 25%, #ffffff); }', 'a.tsx': '<p className="bg-tint" />' });
  assert.equal(byCanon(u, 'rgb(191, 191, 191)', 'token')?.classes, 1, JSON.stringify(u.segments));
});

test('color-mix() follows a var() on either side, and a transparent side thins the alpha', () => {
  const u = run({
    'app.css': ':root { --brand: #0000ff; }\n@theme inline { --color-wash: color-mix(in oklab, var(--brand) 40%, transparent); }',
    'a.tsx': '<p className="bg-wash" />',
  });
  const s = u.segments.find((x) => x.names.includes('--color-wash'));
  assert.ok(s?.canon, JSON.stringify(u.segments));
  assert.equal(s.canon, '0,0,255,40');
});

test('color-mix() over a name defined nowhere is a token with no swatch, as a bare var() is', () => {
  const u = run({ 'app.css': '@theme { --color-wash: color-mix(in srgb, var(--nowhere) 40%, white); }', 'a.tsx': '<p className="bg-wash" />' });
  const s = u.segments.find((x) => x.names.includes('--color-wash'));
  assert.ok(s && !s.canon, JSON.stringify(u.segments));
  assert.deepEqual(u.deadNames.top, []);
});

test('light-dark() reads its daylight side', () => {
  const u = run({ 'app.css': '@theme { --color-paper: light-dark(#fefefe, #101010); }', 'a.tsx': '<p className="bg-paper" />' });
  assert.equal(byCanon(u, '#fefefe', 'token')?.classes, 1, JSON.stringify(u.segments));
});
