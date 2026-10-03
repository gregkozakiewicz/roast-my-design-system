// The profile layer: the repo's kind is decided once, with evidence, and read
// through one accessor. Same answers the harvest block used to give inline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideProfile, profileOf, PROFILES } from '../../skills/roast-my-design-system/scripts/profiles/index.mjs';

const comp = (n, isPage = false) => Array.from({ length: n }, (_, i) => ({ name: `C${i}`, isPage, file: `src/c${i}.tsx`, usageCount: 1 }));
const files = (code) => ({ code: Array.from({ length: code }, (_, i) => `src/f${i}.tsx`), styles: [], other: [] });

test('product is the fallback and the last profile', () => {
  assert.equal(PROFILES.at(-1).kind, 'product');
  const p = decideProfile({ framework: 'next', libraryPkg: null }, comp(12), files(40));
  assert.equal(p.role, 'product');
  assert.equal(p.kind, 'product');
  assert.equal(p.kindConfidence, 'high');
  assert.ok(p.kindEvidence[0].includes('no publishable'));
  assert.deepEqual(p.componentDetection, { measured: true });
});

test('a publishable components package with no pages is a library, with the receipt', () => {
  const p = decideProfile({ framework: 'react', libraryPkg: '@acme/ui' }, comp(20), files(60));
  assert.equal(p.role, 'library');
  assert.match(p.kindEvidence[0], /@acme\/ui with 20 reusable components and 0 pages/);
});

test('the same package with app pages next to it stays a product, and says why', () => {
  const p = decideProfile({ framework: 'react', libraryPkg: '@acme/ui' }, [...comp(20), ...comp(5, true)], files(60));
  assert.equal(p.role, 'product');
  assert.match(p.kindEvidence[0], /app pages next to its components/);
});

test('web components with no pages are a library whatever the package is named', () => {
  const p = decideProfile({ framework: 'web components (Lit)', libraryPkg: null }, comp(15), files(60));
  assert.equal(p.role, 'library');
  assert.match(p.kindEvidence[0], /15 registered web components/);
});

test('an unreadable stack with almost nothing found is not measured, never zeros', () => {
  const p = decideProfile({ framework: 'unknown', libraryPkg: null, unreadableComponentStack: 'Vue single-file components' }, comp(1), files(5));
  assert.deepEqual(p.componentDetection, { measured: false, reason: 'Vue single-file components' });
  const q = decideProfile({ framework: 'unknown', libraryPkg: null, unreadableComponentStack: null }, comp(2), files(40));
  assert.equal(q.componentDetection.measured, false);
  const r = decideProfile({ framework: 'unknown', libraryPkg: null, unreadableComponentStack: null }, comp(2), files(10));
  assert.equal(r.componentDetection.measured, true);
});

test('profileOf reads a harvest, a bare profile, and a pre-profile-layer harvest alike', () => {
  const p = decideProfile({ framework: 'react', libraryPkg: '@acme/ui', vendoredUi: true, uiDir: 'src/ui' }, comp(20), files(60));
  const a = profileOf({ profile: p }), b = profileOf(p);
  assert.deepEqual(a, b);
  assert.equal(a.isLibrary, true);
  assert.equal(a.vendoredUi, true);
  assert.equal(a.uiDir, 'src/ui');
  assert.equal(a.componentsMeasured, true);
  // an older harvest.json: role only, no kind or evidence
  const old = profileOf({ profile: { role: 'library', componentDetection: { measured: false, reason: 'Angular components' } } });
  assert.equal(old.isLibrary, true);
  assert.equal(old.kind, 'library');
  assert.deepEqual(old.evidence, []);
  assert.equal(old.componentsMeasured, false);
  assert.equal(old.notMeasuredReason, 'Angular components');
  assert.equal(profileOf(null).kind, 'product');
});
