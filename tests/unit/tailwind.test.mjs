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

function recognise(files) {
  const root = mkdtempSync(join(tmpdir(), 'roast-tw-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/theme.css'), theme);
    for (const [f, body] of Object.entries(files)) writeFileSync(join(root, f), body);
    const profile = { stylingDeps: ['Tailwind CSS'] };
    const ctx = {
      root,
      files: {
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
