// The doorway guard-my-design-system imports: the profile facts and the
// shared rules must be there and must match what the report decided.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as api from '../../skills/roast-my-design-system/scripts/lib/guard-api.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, '..', 'fixtures');

test('a shadcn kit tells the guard its installed folders and that the palette check applies', () => {
  const s = api.learnSystem(join(FIX, 'shadcnfactory'));
  assert.equal(s.profile.kind, 'shadcn');
  assert.ok(s.profile.installedDirs.includes('components/ui'));
  assert.equal(s.profile.paletteReady, true);
  assert.equal(s.profile.sheetFile, 'app/globals.css');
  assert.equal(s.profile.registry, null);
});

test('a registry tells the guard what is counted and owns its published folders', () => {
  const s = api.learnSystem(join(FIX, 'registry'));
  assert.equal(s.profile.kind, 'registry');
  assert.deepEqual(s.profile.installedDirs, []);
  assert.ok(s.profile.registry.countedDirs.includes('registry/radix/ui'));
  assert.ok(s.profile.registry.variants.includes('registry/base/ui'));
});

test('a plain product has no installed folders and no palette check', () => {
  const s = api.learnSystem(join(FIX, 'messy'));
  assert.equal(s.profile.kind, 'product');
  assert.deepEqual(s.profile.installedDirs, []);
  assert.equal(s.profile.paletteReady, false);
});

test('the shared rules are exported and agree with the report', () => {
  assert.equal(api.isLibraryClass('cm-editor'), true);
  assert.equal(api.isLibraryClass('hero'), false);
  assert.ok(api.WIDGET_CSS_RE.test('@import "tailwindcss/utilities.css" layer(utilities) important;'));
  assert.ok(api.WIDGET_CONFIG_RE.test('important: "#fbjs",'));
  assert.ok('bg-blue-500'.match(api.PALETTE_CLASS_RE));
  assert.equal('bg-background'.match(api.PALETTE_CLASS_RE), null);
  assert.equal(api.exemptReason('app/global-error.tsx', '') !== null, true);
});
