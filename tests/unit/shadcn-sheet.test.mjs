// The shadcn sheet reader: which rows it finds under which selectors.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sheetColourRows } from '../../plugin/skills/roast-my-design-system/scripts/profiles/shadcn.mjs';

const rows = (css) => {
  const dir = mkdtempSync(join(tmpdir(), 'roast-sheet-'));
  writeFileSync(join(dir, 'theme.css'), css);
  try { return sheetColourRows(dir, 'theme.css'); } finally { rmSync(dir, { recursive: true, force: true }); }
};

// 9.7.1: documenso declares its light rows under `:root, .dark-mode-disabled`
// and its dark rows under `.dark:not(.dark-mode-disabled)`; neither was read
test(':root heading a selector list is the light block', () => {
  assert.deepEqual(rows(':root,\n  .dark-mode-disabled {\n  --background: 0 0% 100%;\n  --primary: #111111;\n  --radius: 0.5rem;\n}\n'), ['background', 'primary']);
});

test('a plain :root block reads as before', () => {
  assert.deepEqual(rows(':root {\n  --background: 0 0% 100%;\n  --muted: hsl(210 40% 96%);\n}\n.dark {\n  --background: 0 0% 10%;\n}\n'), ['background', 'muted']);
});

test('a .dark block with a :not() is not mistaken for the light one', () => {
  assert.deepEqual(rows('.dark:not(.dark-mode-disabled) {\n  --background: 0 0% 10%;\n}\n:root {\n  --background: 0 0% 100%;\n  --ring: #222222;\n}\n'), ['background', 'ring']);
});
