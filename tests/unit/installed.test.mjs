// Installed code under the agent-safety definition: bracket values inside
// installed folders are kept out of the count and named; registry palette
// colours stay in the score; the breakdown says what installed code costs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitArbitrary, installedDirs } from '../../skills/roast-my-design-system/scripts/profiles/index.mjs';
import { coreMetrics, scoreBreakdown, tileHealths, makeHealthOf, benchHelpers, loadBenchmark } from '../../skills/roast-my-design-system/scripts/diagnose/score.mjs';

const entries = [
  { value: '[3px]', count: 9, files: [{ file: 'components/ui/badge.tsx', count: 2 }, { file: 'components/ui/tabs.tsx', count: 1 }, { file: 'app/page.tsx', count: 3 }] }, // 3 listed uses unattributed: own by remainder
  { value: '[2.5rem]', count: 8, files: [{ file: 'components/ui/sheet.tsx', count: 8 }] },
  { value: '[13px]', count: 25, files: [{ file: 'components/chat/nav.tsx', count: 25 }] },
  { value: '[10px]', count: 4, files: [{ file: 'components/ai-elements/tool.tsx', count: 4 }] },
];

test('splitArbitrary keeps own uses as the remainder of each entry and names the installed values', () => {
  const dirs = ['components/ui', 'components/ai-elements'];
  const { own, installed } = splitArbitrary(entries, dirs);
  assert.equal(installed.uses, 3 + 8 + 4);
  assert.deepEqual(installed.values.map((v) => v.value), ['[2.5rem]', '[10px]', '[3px]']);
  const ownTotal = own.reduce((s, e) => s + e.count, 0);
  assert.equal(ownTotal, 9 - 3 + 25);
  assert.equal(own[0].value, '[13px]');
  assert.ok(!own.some((e) => e.value === '[2.5rem]'));
  // the sum of own and installed is the total: nothing is lost to a capped file list
  assert.equal(ownTotal + installed.uses, entries.reduce((s, e) => s + e.count, 0));
});

test('with no installed folders nothing changes', () => {
  const { own, installed } = splitArbitrary(entries, []);
  assert.equal(own, entries);
  assert.equal(installed.uses, 0);
});

test('installedDirs lists the catalogue, registries and kit blocks', () => {
  const P = { uiDirs: ['components/ui'], shadcn: { registryDirs: ['components/ai-elements'], blockFiles: ['components/login-form.tsx'] } };
  assert.deepEqual(installedDirs(P), ['components/ui', 'components/ai-elements', 'components/login-form.tsx']);
});

const base = { colors: [], tailwind: { spacing: [], arbitrary: entries }, spacing: [], inlineStyles: { count: 0 }, important: { count: 0 } };
const harvestOf = (shadcn) => ({ profile: { kind: 'shadcn', role: 'product', uiDirs: ['components/ui'], designSystem: { kind: 'shadcn', cssVariables: true }, vendoredUi: true, shadcn }, tokens: base, components: [], duplicates: { exactDuplicates: [] } });

test('on a shadcn repo the bracket metric is the own count; registries count in the paint tiles', () => {
  const h = harvestOf({ registryDirs: ['components/ai-elements'], blockFiles: [], paint: { tin: { per100: 66 }, doors: { per100: 10 } }, paintOwn: { tin: { per100: 20 }, doors: { per100: 10 } } });
  const m = coreMetrics(h);
  assert.equal(m.arbitrary, 31);
  assert.equal(m.paintTin, 66);
  const own = coreMetrics(h, { ownCode: true });
  assert.equal(own.paintTin, 20);
  const b = scoreBreakdown(h);
  assert.ok(b.ownScore > b.score, `own ${b.ownScore} should beat all ${b.score}`);
  assert.equal(b.installedPoints, b.ownScore - b.score);
});

test('no registries: no breakdown', () => {
  const h = harvestOf({ registryDirs: [], blockFiles: [], paint: { tin: { per100: 0 }, doors: { per100: 0 } } });
  const b = scoreBreakdown(h);
  assert.equal(b.ownScore, null);
  assert.equal(b.installedPoints, 0);
});

test('a product repo counts every bracket', () => {
  const h = { profile: { kind: 'product', role: 'product' }, tokens: base, components: [], duplicates: { exactDuplicates: [] } };
  assert.equal(coreMetrics(h).arbitrary, 46);
  const healthOf = makeHealthOf(benchHelpers(loadBenchmark(), 'product'));
  assert.equal(tileHealths(coreMetrics(h), healthOf).length, 9);
});
