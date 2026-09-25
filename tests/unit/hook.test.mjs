// The Claude Code edit hook: --hook reads a PostToolUse event on stdin and
// answers with the new findings of the one file that changed, or nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { newSince } from '../../skills/roast-my-design-system/scripts/mcp/hook.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(HERE, '../../cli/roast.mjs');
const MESSY = join(HERE, '../fixtures/messy');

// a git copy of the messy fixture, committed, so "before" has a HEAD to read
function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'roast-hook-'));
  cpSync(MESSY, dir, { recursive: true });
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  git('init', '-q');
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init');
  return dir;
}
const hook = (dir, event) => spawnSync(process.execPath, [BIN, '--hook'], {
  cwd: dir, input: JSON.stringify(event), encoding: 'utf8', env: { ...process.env, CI: '1' },
});
const event = (dir, file, tool = 'Write') => ({ cwd: dir, tool_name: tool, hook_event_name: 'PostToolUse', tool_input: { file_path: join(dir, file) } });

test('a new file with invented values comes back as findings for the agent', () => {
  const dir = repo();
  writeFileSync(join(dir, 'components/Probe.tsx'), "export const P = () => <div style={{ color: '#ff00ff' }}>p</div>;\n");
  const r = hook(dir, event(dir, 'components/Probe.tsx'));
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  const ctx = out.hookSpecificOutput.additionalContext;
  assert.equal(out.hookSpecificOutput.hookEventName, 'PostToolUse');
  assert.match(ctx, /components\/Probe\.tsx/);
  assert.match(ctx, /Hardcoded colour #ff00ff/);
  assert.match(ctx, /Static inline style block/);
  assert.match(ctx, /Checked: /);
  rmSync(dir, { recursive: true, force: true });
});

test('a committed file touched without new drift stays silent', () => {
  const dir = repo();
  // page.tsx already carries two inline styles at HEAD; add a line that is on-system
  appendFileSync(join(dir, 'app/x/page.tsx'), '\nexport const touched = true;\n');
  const r = hook(dir, event(dir, 'app/x/page.tsx', 'Edit'));
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '', r.stdout);
  rmSync(dir, { recursive: true, force: true });
});

test('a committed file that gains drift reports only the new part', () => {
  const dir = repo();
  const f = join(dir, 'app/x/page.tsx');
  writeFileSync(f, readFileSync(f, 'utf8') + '\nexport const Extra = () => <p style={{ color: "#ff00ff" }}>x</p>;\n');
  const r = hook(dir, event(dir, 'app/x/page.tsx', 'Edit'));
  const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
  assert.match(ctx, /Hardcoded colour #ff00ff/);
  // the two inline styles that were already there are not repeated; only the new one is
  assert.equal((ctx.match(/Static inline style block/g) ?? []).length, 1, ctx);
  rmSync(dir, { recursive: true, force: true });
});

test('files that are not UI, missing files and an empty event all stay silent and exit 0', () => {
  const dir = repo();
  for (const ev of [event(dir, 'CLAUDE.md', 'Edit'), event(dir, 'components/Nope.tsx'), {}, { tool_input: {} }]) {
    const r = hook(dir, ev);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '', JSON.stringify(ev));
  }
  const empty = spawnSync(process.execPath, [BIN, '--hook'], { cwd: dir, input: '', encoding: 'utf8' });
  assert.equal(empty.status, 0);
  assert.equal(empty.stdout, '');
  rmSync(dir, { recursive: true, force: true });
});

test('a file written by a shell command is judged on the Bash event, once', () => {
  const dir = repo();
  const sid = `roast-hook-test-${process.pid}-${Date.now()}`;
  writeFileSync(join(dir, 'components/Shelled.tsx'), "export const S = () => <div style={{ color: '#00ffee' }}>s</div>;\n");
  const bash = { cwd: dir, session_id: sid, tool_name: 'Bash', hook_event_name: 'PostToolUse', tool_input: { command: 'cat > components/Shelled.tsx' } };
  const first = hook(dir, bash);
  assert.equal(first.status, 0);
  const ctx = JSON.parse(first.stdout).hookSpecificOutput.additionalContext;
  assert.match(ctx, /components\/Shelled\.tsx/);
  assert.match(ctx, /Hardcoded colour #00ffee/);
  // the next shell command changes nothing: the ledger keeps the hook quiet
  const again = hook(dir, { ...bash, tool_input: { command: 'ls' } });
  assert.equal(again.stdout, '', again.stdout);
  // the file changes again: judged again
  appendFileSync(join(dir, 'components/Shelled.tsx'), '// touched\n');
  const third = hook(dir, { ...bash, tool_input: { command: 'sed -i s/a/b/ components/Shelled.tsx' } });
  assert.match(JSON.parse(third.stdout).hookSpecificOutput.additionalContext, /#00ffee/);
  rmSync(dir, { recursive: true, force: true });
  rmSync(join(tmpdir(), `roast-hook-${sid}.json`), { force: true });
});

test('a Bash event with no changed UI files stays silent', () => {
  const dir = repo();
  const r = hook(dir, { cwd: dir, session_id: 'x', tool_name: 'Bash', tool_input: { command: 'ls' } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  rmSync(dir, { recursive: true, force: true });
});

test('a broken event never fails the hook', () => {
  const r = spawnSync(process.execPath, [BIN, '--hook'], { input: '{not json', encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /--hook/);
});

test('newSince subtracts prior findings kind by kind', () => {
  const f = (rule, message, line) => ({ rule, message, line });
  const prior = [f('inline', 'Static inline style block.', 3), f('inline', 'Static inline style block.', 4)];
  const now = [...prior, f('inline', 'Static inline style block.', 9), f('colour', 'Hardcoded colour #ff00ff', 9)];
  assert.deepEqual(newSince(now, prior).map((x) => x.line), [9, 9]);
  assert.deepEqual(newSince(prior, now), []);
});
