// The shadcn card: recognition through the config's alias and by door names,
// the sheet read by row, the kit read the way `preset resolve` reads it, and
// the 2 paint checks counted over own code only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { walkRepo, profileRepo } from '../../skills/roast-my-design-system/scripts/harvest/walk.mjs';
import { harvestComponents } from '../../skills/roast-my-design-system/scripts/harvest/components.mjs';
import { decideProfile, profileOf } from '../../skills/roast-my-design-system/scripts/profiles/index.mjs';
import { countPaint } from '../../skills/roast-my-design-system/scripts/harvest/paint.mjs';
import { coreMetrics, tileHealths, makeHealthOf, benchHelpers, loadBenchmark } from '../../skills/roast-my-design-system/scripts/diagnose/score.mjs';
import { profileYardstick } from '../../skills/roast-my-design-system/scripts/profiles/index.mjs';

const write = (root, files) => {
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(join(root, p, '..'), { recursive: true });
    writeFileSync(join(root, p), body);
  }
};
const door = (name) => `import * as React from "react"\nexport function ${name}({ className, ...props }) { return <div className={className} {...props} /> }\n`;
const catalogue = (dir, names) => Object.fromEntries(names.map((n) => [`${dir}/${n}.tsx`, door(n[0].toUpperCase() + n.slice(1))]));
const NINE = ['button', 'card', 'input', 'label', 'badge', 'dialog', 'select', 'tabs', 'checkbox'];

function scan(root) {
  const files = walkRepo(root, 14, { patterns: [] });
  const profile = profileRepo(root, files);
  const { components } = harvestComponents(root, files.code);
  decideProfile(profile, components, files, root);
  return { files, profile, components };
}

test('a catalogue behind a tsconfig alias in a workspace is found, with the receipt', () => {
  const root = mkdtempSync(join(tmpdir(), 'rmds-shadcn-'));
  try {
    write(root, {
      'package.json': '{"name":"mono","private":true,"workspaces":["apps/*","packages/*"]}',
      'apps/web/package.json': '{"name":"web","dependencies":{"tailwindcss":"4.1.0"}}',
      'apps/web/components.json': JSON.stringify({ style: 'base-vega', tailwind: { css: 'src/app/globals.css', baseColor: 'olive', cssVariables: true }, aliases: { components: '@/components', ui: '@acme/ui/components', utils: '@/lib/utils' }, iconLibrary: 'tabler' }),
      'apps/web/tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'], '@acme/ui/*': ['../../packages/ui/src/*'] } } }),
      'apps/web/src/app/globals.css': ':root { --background: oklch(1 0 0); --primary: oklch(0.527 0.154 150.069); --chart-2: oklch(0.723 0.219 149.579); --radius: 0.875rem; }\n.dark { --background: oklch(0.1 0 0); --primary: oklch(0.6 0.15 150); }',
      'apps/web/src/app/page.tsx': 'import { Button } from "@acme/ui/components/button"\nexport default function Page() { return <Button className="mt-4">Go</Button> }',
      ...catalogue('packages/ui/src/components', NINE),
    });
    const { profile } = scan(root);
    const P = profileOf(profile);
    assert.equal(P.kind, 'shadcn');
    assert.equal(P.confidence, 'high');
    assert.equal(P.uiDir, 'packages/ui/src/components');
    assert.match(P.evidence[0], /components\.json in apps\/web, 9 catalogue components in packages\/ui\/src\/components/);
    assert.equal(P.shadcn.kit.front, 'vega');
    assert.equal(P.shadcn.kit.base, 'base');
    assert.equal(P.shadcn.kit.baseColor, 'olive');
    assert.equal(P.shadcn.kit.theme, 'green');
    assert.equal(P.shadcn.kit.chartColor, 'green');
    assert.equal(P.shadcn.kit.radius, 'large');
    assert.equal(P.shadcn.kit.tailwind, '4');
    assert.equal(P.shadcn.kit.iconLibrary, 'tabler');
    assert.equal(P.shadcn.sheet.file, 'apps/web/src/app/globals.css');
    assert.deepEqual(P.shadcn.sheet.missingDark, ['chart-2']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a catalogue with no components.json is recognised by its door names, at medium confidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'rmds-shadcn-'));
  try {
    write(root, { 'package.json': '{"name":"old","private":true}', ...catalogue('components/ui', NINE), 'app/page.tsx': 'export default function Page() { return <div /> }' });
    const { profile } = scan(root);
    const P = profileOf(profile);
    assert.equal(P.kind, 'shadcn');
    assert.equal(P.confidence, 'medium');
    assert.match(P.evidence[0], /9 catalogue components in components\/ui, no components\.json/);
    assert.equal(P.shadcn.kit, null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a hand-written ui folder with 3 files and no config is not a shadcn kitchen', () => {
  const root = mkdtempSync(join(tmpdir(), 'rmds-shadcn-'));
  try {
    write(root, { 'package.json': '{"name":"own","private":true}', ...catalogue('components/ui', ['button', 'card', 'modal']), 'app/page.tsx': 'export default function Page() { return <div /> }' });
    const { profile } = scan(root);
    assert.equal(profileOf(profile).kind, 'product');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('paint from a tin and repainted doors are counted over own code only, never inside the catalogue', () => {
  const root = mkdtempSync(join(tmpdir(), 'rmds-shadcn-'));
  try {
    write(root, {
      'package.json': '{"name":"p","private":true}',
      'components.json': JSON.stringify({ style: 'new-york', tailwind: { css: 'app/globals.css', baseColor: 'zinc', cssVariables: true }, aliases: { components: '@/components', ui: '@/components/ui' } }),
      'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['./*'] } } }),
      'app/globals.css': ':root { --background: oklch(1 0 0); }\n.dark { --background: oklch(0 0 0); }',
      ...catalogue('components/ui', NINE),
      // a kit door edited on purpose: palette classes inside the catalogue are never counted
      'components/ui/button.tsx': 'export function Button({ className }) { return <button className="bg-zinc-900 text-white dark:bg-white" /> }',
      'app/page.tsx': 'import { Card } from "@/components/ui/card"\nimport { Button } from "@/components/ui/button"\nexport default function Page() { return <main className="text-gray-500 dark:text-gray-400 bg-white dark:bg-black"><Card className="bg-blue-100 font-bold">x</Card><Button className="mt-2 w-full">ok</Button><Button className="text-red-600">no</Button><span className="text-emerald-600">+1</span></main> }',
      'components/shared/Thing.tsx': 'export function Thing() { return <p className="text-muted-foreground hover:text-blue-500/80">y</p> }',
      'emails/welcome.tsx': 'export default function Welcome() { return <p className="text-gray-900 bg-gray-100">mail</p> }',
      'stories/Button.stories.tsx': 'export const s = <div className="bg-red-500" />',
    });
    const { files, profile, components } = scan(root);
    const P = profileOf(profile);
    const doorFiles = new Set(files.code.filter((f) => f.startsWith('components/ui/')));
    const kitNames = new Set(components.filter((c) => doorFiles.has(c.file)).map((c) => c.name));
    assert.ok(kitNames.has('Card') && kitNames.has('Button'));
    const paint = countPaint(root, files.code, { uiDirs: P.uiDirs, kitNames });
    // own files: app/page.tsx, components/shared/Thing.tsx (emails and stories are out)
    assert.equal(paint.ownFiles, 2);
    // page: text-gray-500, dark:text-gray-400, dark:bg-black, bg-blue-100 (on the Card), text-red-600, text-emerald-600 (6); Thing: hover:text-blue-500/80 (1)
    assert.equal(paint.tin.uses, 7);
    assert.equal(paint.tin.files, 2);
    assert.equal(paint.tin.per100, 350);
    assert.equal(paint.tin.samples[0].count, 1);
    // doors: Card with bg-blue-100 font-bold, Button with text-red-600; the layout-only Button is fine
    assert.equal(paint.doors.uses, 2);
    assert.match(paint.doors.samples.map((s) => s.value).join(' '), /<Card className="bg-blue-100 font-bold">/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the 2 shadcn tiles exist only for a shadcn kitchen, and utility-class mode leaves the tin tile unscored', () => {
  const b = benchHelpers(loadBenchmark(), profileYardstick({ profile: { kind: 'shadcn' } }));
  const healthOf = makeHealthOf(b);
  const base = { colors: [], tailwind: { spacing: [], arbitrary: [] }, spacing: [], inlineStyles: { count: 0 }, important: { count: 0 } };
  const product = coreMetrics({ profile: { kind: 'product' }, tokens: base, components: [], duplicates: { exactDuplicates: [] } });
  assert.equal(tileHealths(product, healthOf).length, 9);
  const shadcn = coreMetrics({ profile: { kind: 'shadcn', designSystem: { kind: 'shadcn', cssVariables: true }, shadcn: { paint: { tin: { per100: 40 }, doors: { per100: 0 } } } }, tokens: base, components: [], duplicates: { exactDuplicates: [] } });
  const tiles = tileHealths(shadcn, healthOf);
  assert.equal(tiles.length, 11);
  assert.equal(tiles.find((t) => t.metric === 'paintTin').health, 'warn');
  assert.equal(tiles.find((t) => t.metric === 'doorOverrides').health, 'good');
  const utility = coreMetrics({ profile: { kind: 'shadcn', designSystem: { kind: 'shadcn', cssVariables: false }, shadcn: { paint: { tin: { per100: 400 }, doors: { per100: 0 } } } }, tokens: base, components: [], duplicates: { exactDuplicates: [] } });
  assert.equal(tileHealths(utility, healthOf).find((t) => t.metric === 'paintTin').health, 'info');
  // the yardstick the card owns never touches a general tile
  assert.equal(b.ideal('colors'), 24);
  assert.equal(b.ideal('paintTin'), 25);
  assert.equal(b.median('paintTin'), 62);
});
