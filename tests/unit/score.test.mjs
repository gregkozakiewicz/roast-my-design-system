// The score as a function: bands, tolerances, the average, and the contract
// summary.json promises to anyone keeping history.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { benchHelpers, makeHealthOf, tileHealths, scoreOfTiles, scorePackage, scoreHarvest, coreMetrics, SCHEMA_VERSION, TILES } from '../../skills/roast-my-design-system/scripts/diagnose/score.mjs';

const bench = {
  builtAt: '2026-01-01T00:00:00.000Z', repoCount: 3,
  ideal2026: { colors: { value: 24 }, greys: { value: 13 }, spacing: { value: 12 }, exactDuplicates: { value: 0 }, inlineStyles: { value: 0 }, nearPairs: { value: 0 }, important: { value: 0 }, neverImported: { value: 0 }, arbitrary: { value: 20 } },
  stats: { colors: { values: [30, 100, 200], median: 100 }, greys: { values: [5, 10, 12], median: 10 }, spacing: { values: [20, 34, 50], median: 34 }, arbitrary: { values: [0, 0, 70], median: 0 } },
  referenceSystems: { count: 2, stats: { colors: { median: 24 } } },
};
const B = benchHelpers(bench);
const healthOf = makeHealthOf(B);

test('bands: ideal, median, 1.5x fallback, zero-ideal tolerance', () => {
  assert.equal(healthOf('colors', 24), 'good');
  assert.equal(healthOf('colors', 100), 'warn', 'at the median is still warn');
  assert.equal(healthOf('colors', 101), 'bad');
  assert.equal(healthOf('greys', 15), 'warn', 'median under the ideal: warn caps at 1.5x ideal (19)');
  assert.equal(healthOf('greys', 20), 'bad');
  assert.equal(healthOf('inlineStyles', 0), 'good');
  assert.equal(healthOf('inlineStyles', 10), 'warn');
  assert.equal(healthOf('inlineStyles', 11), 'bad');
  assert.equal(healthOf('typefaces', 9), 'info', 'no ideal means no judgement');
});

test('yardstick readers: percentile, cleaner share, avg fallback', () => {
  assert.equal(B.percentile('colors', 150), 67);
  assert.equal(B.cleanerPct('colors', 50), 67);
  assert.equal(B.displayAvg('arbitrary'), 23, 'zero median falls back to the mean');
  assert.equal(B.refMedian('colors'), 24);
  assert.equal(benchHelpers(null).ideal('colors'), null);
});

const metrics = (over = {}) => ({
  colors: 10, colorTokens: 8, colorStrays: 2, tokenLed: true, greys: 3, greyStrays: 1, spacing: 5,
  exactDuplicates: 0, inlineStyles: 0, nearPairs: 0, important: 0, neverImported: 0, arbitrary: 0,
  componentsMeasured: true, isLibrary: false, vendoredUi: false, ...over,
});

test('tiles: token-led repos are judged on strays; na and info drop out', () => {
  const all = tileHealths(metrics({ colors: 200, colorStrays: 5 }), healthOf);
  assert.equal(all.length, TILES.length);
  const colours = all.find((t) => t.metric === 'colors');
  assert.equal(colours.value, 200);
  assert.equal(colours.healthValue, 5);
  assert.equal(colours.health, 'good');
  assert.equal(scoreOfTiles(all), 100);

  const unread = tileHealths(metrics({ componentsMeasured: false }), healthOf);
  assert.deepEqual(unread.filter((t) => t.health === 'na').map((t) => t.metric), ['exactDuplicates', 'neverImported']);
  assert.equal(unread.find((t) => t.metric === 'neverImported').value, null);
  const lib = tileHealths(metrics({ isLibrary: true, neverImported: 40 }), healthOf);
  assert.equal(lib.find((t) => t.metric === 'neverImported').health, 'info');
  assert.equal(scoreOfTiles(lib), 100, 'an unscored tile does not drag the average');
});

test('the average: good 100, warn 55, bad 10', () => {
  const tiles = tileHealths(metrics({ tokenLed: false, colors: 101, spacing: 20, inlineStyles: 11 }), healthOf);
  // colours bad (10), spacing warn (55), inline bad (10), six good (600) → 675 / 9 = 75
  assert.equal(scoreOfTiles(tiles), 75);
  assert.equal(scoreOfTiles([]), null);
});

test('scorePackage names the worst tile', () => {
  const p = scorePackage({ colors: 300, colorTokens: 0, colorStrays: 300, greys: 3, greyStrays: 3, spacing: 4, exactDuplicates: 0, inlineStyles: 12, nearPairs: 0, important: 0, neverImported: 0, arbitrary: 0 }, healthOf, B);
  assert.equal(p.worst.metric, 'colors', 'furthest past its ideal');
  assert.equal(p.score, Math.round((10 + 10 + 7 * 100) / 9));
});

test('scoreHarvest: the contract for a history of scans', () => {
  const h = {
    tokens: { colors: [{ value: '#111111', isToken: true, count: 3 }, { value: '#121212', isToken: false, count: 1 }], spacing: [{ value: '13px' }], tailwind: { spacing: [{ value: '[7px]' }, { value: '4' }], arbitrary: [{ value: '[10px]', count: 2 }] }, inlineStyles: { count: 1 }, important: { count: 0 } },
    duplicates: { exactDuplicates: [{ name: 'A', files: ['a', 'b'] }, { name: 'B', files: ['c', 'd'], wrapped: true }] },
    components: [], profile: {},
  };
  const m = coreMetrics(h);
  assert.equal(m.spacing, 2, 'one CSS value plus one bracket');
  assert.equal(m.exactDuplicates, 1, 'a wrapped pair is composition');
  assert.equal(m.nearPairs, 1, '#111111 and #121212 are twins');
  assert.equal(m.greys, 2);
  assert.equal(m.greyStrays, 1);
  const s = scoreHarvest(h, bench);
  assert.equal(s.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(s.benchmark, { builtAt: bench.builtAt, repoCount: 3, referenceSystems: 2 });
  assert.equal(typeof s.score, 'number');
  assert.ok(s.tiles.every((t) => typeof t.metric === 'string' && 'value' in t && 'health' in t));
  assert.equal(scoreHarvest(h, null).benchmark, null, 'no ruler, and it says so');
  assert.equal(scoreHarvest(h, null).score, null, 'no ruler means no judgement at all');
});
