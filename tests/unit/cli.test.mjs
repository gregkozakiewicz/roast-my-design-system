// The npx wrapper's doors: help, bad paths, half-given flags, JSON output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(HERE, '../../bin/roast.mjs');
const CLEAN = join(HERE, '../fixtures/clean');
const run = (...args) => spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8', env: { ...process.env, CI: '1' } });

test('--help exits 0 and names the flags', () => {
  const r = run('--help');
  assert.equal(r.status, 0);
  for (const f of ['--out', '--apply', '--mcp', '--check', '--exclude']) assert.ok(r.stdout.includes(f), f);
});

test('a path that is not a directory is refused with the path in the message', () => {
  const r = run('/definitely/not/here', '--no-open');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Not a directory: \/definitely\/not\/here/);
});

test('--section needs both a title and a file', () => {
  const r = run(CLEAN, '--section', 'Only a title', '--no-open');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--section needs a title and a file/);
});

test('--notes pointing at a missing file is a hard error, not a silent skip', () => {
  const r = run(CLEAN, '--notes', '/nope/notes.md', '--no-open');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--notes: cannot read \/nope\/notes\.md/);
});

test('--json prints the versioned summary and nothing else on stdout', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'roast-cli-'));
  const r = run(CLEAN, '--json', '--out', join(tmp, 'r.html'));
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.schemaVersion, 1);
  assert.equal(typeof j.score, 'number');
  assert.ok(j.benchmark && j.benchmark.repoCount > 0, 'the ruler is named');
  assert.ok(j.tiles.every((t) => t.metric && (typeof t.value === 'number' || t.value === null) && typeof t.display === 'string'));
  assert.equal(typeof j.metrics.colors, 'number');
  rmSync(tmp, { recursive: true, force: true });
});
