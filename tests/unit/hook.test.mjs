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
  cwd: dir, input: JSON.stringify(event), encoding: 'utf8',
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

test('a warning is said once per file in a session; a violation repeats until fixed', () => {
  const dir = repo();
  const sid = `roast-hook-warn-${process.pid}-${Date.now()}`;
  // a chart painting by hand in a repo with no chart palette: one warning (chart-palette)
  const chart = "import { Bar } from 'recharts';\nconst S = ['#2563eb', '#16a34a', '#f59e0b'];\nexport function C() { return <Bar fill={S[0]} />; }\n";
  writeFileSync(join(dir, 'components/UsageChart.tsx'), chart);
  const ev = { ...event(dir, 'components/UsageChart.tsx'), session_id: sid };
  const first = JSON.parse(hook(dir, ev).stdout).hookSpecificOutput.additionalContext;
  assert.match(first, /This chart paints its 3 series colours by hand|First chart in this repo/);
  // the same file edited again, warning still true: silence
  appendFileSync(join(dir, 'components/UsageChart.tsx'), '// touched\n');
  assert.equal(hook(dir, { ...ev, tool_name: 'Edit' }).stdout, '');
  // a violation in the same file is still reported
  appendFileSync(join(dir, 'components/UsageChart.tsx'), "export const X = () => <div style={{ padding: '3px' }}>x</div>;\n");
  const third = hook(dir, { ...ev, tool_name: 'Edit' }).stdout;
  assert.match(third, /Static inline style block/);
  assert.doesNotMatch(third, /This chart paints|First chart/);
  rmSync(dir, { recursive: true, force: true });
  rmSync(join(tmpdir(), `roast-hook-${sid}.json`), { force: true });
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

// ---------- the review at the end of the turn ----------
// Stop: judge what this session changed, send the agent back once when it
// added violations. SessionStart notes the work that was already there.
const stop = (dir, ev, env = {}) => spawnSync(process.execPath, [BIN, '--stop-hook'], {
  cwd: dir, input: JSON.stringify({ cwd: dir, hook_event_name: 'Stop', stop_hook_active: false, ...ev }), encoding: 'utf8',
  env: { ...process.env, ROAST_STOP_REVIEW: '', ...env },
});
const start = (dir, session) => spawnSync(process.execPath, [BIN, '--session-start'], {
  cwd: dir, input: JSON.stringify({ cwd: dir, hook_event_name: 'SessionStart', session_id: session }), encoding: 'utf8',
});
const sid = () => `stop-test-${process.pid}-${Math.random().toString(36).slice(2)}`;
const DRIFT = "export const P = () => <div style={{ color: '#ff00ff' }}>p</div>;\n";

test('the end-of-turn review sends the agent back once with what it added', () => {
  const dir = repo(); const session = sid();
  start(dir, session);
  writeFileSync(join(dir, 'components/Probe.tsx'), DRIFT);
  hook(dir, { ...event(dir, 'components/Probe.tsx'), session_id: session });
  const r = stop(dir, { session_id: session });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /Before you finish/);
  assert.match(out.reason, /components\/Probe\.tsx/);
  assert.match(out.reason, /Hardcoded colour #ff00ff/);
  // the stop right after a block always goes through: one round, never a loop
  const again = stop(dir, { session_id: session, stop_hook_active: true });
  assert.equal(again.stdout, '');
  // and a problem the agent kept on purpose is not sent back at the end of
  // every later turn: once a session
  assert.equal(stop(dir, { session_id: session }).stdout, '');
  // a new problem in a later turn still is
  writeFileSync(join(dir, 'components/Later.tsx'), DRIFT.replace('#ff00ff', '#00ffaa').replace('P =', 'L ='));
  hook(dir, { ...event(dir, 'components/Later.tsx'), session_id: session });
  const later = JSON.parse(stop(dir, { session_id: session }).stdout);
  assert.match(later.reason, /Later\.tsx/);
  assert.doesNotMatch(later.reason, /Probe\.tsx/);
  rmSync(dir, { recursive: true, force: true });
});

test('once the agent fixes it, the end-of-turn review is silent', () => {
  const dir = repo(); const session = sid();
  start(dir, session);
  writeFileSync(join(dir, 'components/Probe.tsx'), DRIFT);
  hook(dir, { ...event(dir, 'components/Probe.tsx'), session_id: session });
  writeFileSync(join(dir, 'components/Probe.tsx'), 'export const P = () => <div className="probe">p</div>;\n');
  hook(dir, { ...event(dir, 'components/Probe.tsx', 'Edit'), session_id: session });
  assert.equal(stop(dir, { session_id: session }).stdout, '');
  rmSync(dir, { recursive: true, force: true });
});

test('work that was uncommitted before the session is not the agent\'s to fix', () => {
  const dir = repo(); const session = sid();
  writeFileSync(join(dir, 'components/Before.tsx'), DRIFT);
  start(dir, session);
  // a shell command in the session: the hook looks at every changed file,
  // the one that was already there included
  writeFileSync(join(dir, 'components/After.tsx'), DRIFT.replace('P =', 'A ='));
  hook(dir, { cwd: dir, tool_name: 'Bash', hook_event_name: 'PostToolUse', tool_input: { command: 'cat > components/After.tsx' }, session_id: session });
  const out = JSON.parse(stop(dir, { session_id: session }).stdout);
  assert.match(out.reason, /components\/After\.tsx/);
  assert.doesNotMatch(out.reason, /Before\.tsx/);
  rmSync(dir, { recursive: true, force: true });
});

test('the off switch, a session with no edits and a broken event all stay silent', () => {
  const dir = repo(); const session = sid();
  start(dir, session);
  writeFileSync(join(dir, 'components/Probe.tsx'), DRIFT);
  hook(dir, { ...event(dir, 'components/Probe.tsx'), session_id: session });
  assert.equal(stop(dir, { session_id: session }, { ROAST_STOP_REVIEW: 'off' }).stdout, '');
  assert.equal(stop(dir, { session_id: sid() }).stdout, '');
  const broken = spawnSync(process.execPath, [BIN, '--stop-hook'], { cwd: dir, input: '{not json', encoding: 'utf8' });
  assert.equal(broken.status, 0);
  assert.equal(broken.stdout, '');
  rmSync(dir, { recursive: true, force: true });
});

test('a warning alone never sends the agent back', () => {
  const dir = repo(); const session = sid();
  start(dir, session);
  // on-system code: nothing a violation could come from
  writeFileSync(join(dir, 'components/Quiet.tsx'), 'export const Q = () => <div className="quiet">q</div>;\n');
  hook(dir, { ...event(dir, 'components/Quiet.tsx'), session_id: session });
  assert.equal(stop(dir, { session_id: session }).stdout, '');
  rmSync(dir, { recursive: true, force: true });
});
