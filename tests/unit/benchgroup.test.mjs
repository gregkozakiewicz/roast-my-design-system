// The verdict names the group its medians come from (9.7.0). A shadcn repo
// is compared with the shadcn repos in the benchmark, an MUI product with the
// MUI ones; the sentence said "the median of 34 scanned repos" on 51 of 204
// fleet scans whose medians came from a group, and the tiles said "Avg
// registry repo" for a group that does not exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(HERE, '../../plugin/skills/roast-my-design-system/scripts');
const bench = JSON.parse(readFileSync(join(ENGINE, 'benchmark/benchmark.json'), 'utf8'));

test('a messy shadcn repo is called messier than the shadcn group, by its own count', () => {
  const root = mkdtempSync(join(tmpdir(), 'roast-benchgroup-'));
  try {
    cpSync(join(HERE, '../fixtures/shadcnfresh'), root, { recursive: true });
    // well past the shadcn group's medians on colours, spacing and inline styles
    const hex = (i) => `#${(0x203040 + i * 0x050301).toString(16).padStart(6, '0').slice(-6)}`;
    writeFileSync(join(root, 'app/messy.css'), Array.from({ length: 120 }, (_, i) => `.c${i} { color: ${hex(i)}; padding: ${i + 3}px; }`).join('\n'));
    writeFileSync(join(root, 'app/inline.tsx'), `export const X = () => <>${Array.from({ length: 60 }, (_, i) => `<div style={{ margin: ${i + 1} }}>x</div>`).join('')}</>;\n`);
    const h = join(root, 'h.json'), s = join(root, 's.json'), html = join(root, 'r.html');
    execFileSync(process.execPath, [join(ENGINE, 'harvest/index.mjs'), root, '--out', h], { stdio: 'ignore' });
    execFileSync(process.execPath, [join(ENGINE, 'diagnose/index.mjs'), h, '--out', html, '--summary', s], { stdio: 'ignore' });
    const sum = JSON.parse(readFileSync(s, 'utf8'));
    assert.equal(sum.kind, 'shadcn');
    assert.match(sum.verdict, new RegExp(`Messier than the median of ${bench.slices.shadcn.repoCount} scanned shadcn repos on \\d of 6 core metrics\\.`));
    assert.doesNotMatch(sum.verdict, new RegExp(`median of ${bench.repoCount} scanned repos`));
    const page = readFileSync(html, 'utf8');
    assert.match(page, /Avg shadcn repo/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the group names read as people write them', async () => {
  const src = readFileSync(join(ENGINE, 'diagnose/index.mjs'), 'utf8');
  const names = JSON.parse(src.match(/const GROUP_NAMES = (\{[^}]+\})/)[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
  // every group the benchmark carries has a name, and a registry reads as shadcn
  for (const k of Object.keys(bench.slices)) assert.ok(names[k], k);
  assert.equal(names.registry, 'shadcn');
  assert.deepEqual([names.mui, names.antd, names.tailwind], ['MUI', 'Ant Design', 'Tailwind']);
});
