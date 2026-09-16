// The tailwind profile: what counts as a repo's own colour vocabulary, and
// where its uses are counted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import tailwind from '../../skills/roast-my-design-system/scripts/profiles/tailwind.mjs';

const theme = `@import "tailwindcss";
@theme {
  --color-white: #fff;
  --color-black: #000;
  --color-transparent: transparent;
  --color-brand-500: #0a0;
  --color-brand-700: #070;
  --color-accent: #a0a;
  --color-danger: #a00;
  --color-surface: #eee;
  --color-ink: #111;
}
`;

function recognise(files, css = theme, other = []) {
  const root = mkdtempSync(join(tmpdir(), 'roast-tw-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/theme.css'), css);
    for (const [f, body] of Object.entries(files)) writeFileSync(join(root, f), body);
    const profile = { stylingDeps: ['Tailwind CSS'] };
    const ctx = {
      root,
      files: {
        other,
        styles: ['src/theme.css', ...Object.keys(files).filter((f) => f.endsWith('.css'))],
        code: Object.keys(files).filter((f) => !f.endsWith('.css')),
      },
    };
    return { result: tailwind.recognise(profile, {}, ctx), profile };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("Tailwind's own black, white and transparent are not the repo's vocabulary", () => {
  const { profile } = recognise({ 'src/a.tsx': '<div className="bg-brand-500" />' });
  assert.deepEqual(profile.tailwind.names, ['brand-500', 'brand-700', 'accent', 'danger', 'surface', 'ink']);
  assert.equal(profile.tailwind.restated, 3);
});

test('bg-white and text-black are not uses of the theme', () => {
  const { result } = recognise({ 'src/a.tsx': '<div className="bg-white text-black" />' });
  assert.equal(result, null);
});

test('@apply in a stylesheet counts as use', () => {
  const rule = '.card { @apply bg-surface text-ink border-brand-500; }\n';
  const { profile } = recognise({ 'src/card.module.css': rule.repeat(7) });
  assert.equal(profile.tailwind.uses, 21);
  assert.equal(profile.tailwind.usedIn, 1);
  assert.equal(profile.tailwind.adopted, true);
});

test('a class name outside @apply in a stylesheet is not a use', () => {
  const { result } = recognise({ 'src/b.css': '/* bg-surface */ .bg-surface { color: red; }\n' });
  assert.equal(result, null);
});

const small = (names) => `@theme {\n${names.map((n) => `  --color-${n}: #123;`).join('\n')}\n}\n`;

test('three colours of its own are enough; two are not', () => {
  const page = { 'src/a.tsx': '<div className="bg-brand-50 text-brand-500 border-brand-600" />' };
  assert.ok(recognise(page, small(['brand-50', 'brand-500', 'brand-600'])).result);
  assert.equal(recognise(page, small(['brand-50', 'brand-500'])).result, null);
});

test('a Tailwind name given a new colour is the repo\'s own; an unchanged copy is not', () => {
  const css = `@theme {
  --color-gray-50: #eaeaea;
  --color-gray-600: #454545;
  --color-yellow-500: var(--color-amber-500);
  --color-red-500: oklch(63.7% 0.237 25.331);
  --color-red-600: var(--color-red-600);
}
`;
  const page = { 'src/a.tsx': '<div className="bg-gray-50 text-gray-600 hover:bg-yellow-500/50 text-red-500" />' };
  const { profile } = recognise(page, css);
  assert.deepEqual(profile.tailwind.retuned, ['gray-50', 'gray-600', 'yellow-500']);
  assert.equal(profile.tailwind.restated, 2);
  assert.equal(profile.tailwind.uses, 3);
});

test('a repo whose interface is mostly Svelte or Vue is not judged as a Tailwind theme', () => {
  const page = { 'src/a.tsx': '<div className="bg-brand-500" />' };
  assert.equal(recognise(page, theme, ['src/A.svelte', 'src/B.svelte']).result, null);
  assert.ok(recognise(page, theme, ['src/A.vue']).result);
});

test('a slice ideal replaces the general one for that kind only', async () => {
  const { benchHelpers } = await import('../../skills/roast-my-design-system/scripts/diagnose/score.mjs');
  const bench = { ideal2026: { paintTin: { value: 25 } }, stats: {}, slices: { tailwind: { stats: {}, ideal2026: { paintTin: { value: 3 } } } } };
  assert.equal(benchHelpers(bench, 'tailwind').ideal('paintTin'), 3);
  assert.equal(benchHelpers(bench, 'shadcn').ideal('paintTin'), 25);
});
