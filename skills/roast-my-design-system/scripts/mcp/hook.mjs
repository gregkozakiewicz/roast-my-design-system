/**
 * The edit hook — roast_validate without the agent having to ask.
 *
 * The MCP tools only help when the agent decides to call them. In the
 * September 2026 runs Sonnet asked in about a third of sessions and Haiku
 * never did, so the drift it would have caught went straight into the
 * diff. A Claude Code plugin can also register a hook that runs after every
 * Edit or Write; this is that hook. It reads the event, judges the one file
 * that changed with the same engine and the same words as roast_validate,
 * and hands the findings back as context. Silent when there is nothing to
 * say: a hook that talks on every edit is a hook people switch off.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { validateContent } from './engine.mjs';
import { loadKnowledge } from './knowledge.mjs';
import { RELEVANT, beforeOf, findingLines } from './tools.mjs';

const gitTop = (dir) => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
};

// The files a shell command may have written: everything changed or untracked
// in the repo that the review would judge. Cheap (two git calls), and the
// mtime ledger below keeps it from re-judging what the hook already saw.
function changedFiles(root) {
  try {
    const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const top = realpathSync.native(git('rev-parse', '--show-toplevel').trim());
    const names = [...git('diff', 'HEAD', '--name-only').split('\n'), ...git('ls-files', '--others', '--exclude-standard', '--full-name').split('\n')];
    return [...new Set(names.map((s) => s.trim()).filter((f) => f && RELEVANT.test(f)))].map((f) => join(top, f));
  } catch { return []; }
}

// What the hook has judged this session, file → mtime, so a file is judged
// once per change however it was written, and never twice for one save.
const ledgerPath = (session) => join(tmpdir(), `roast-hook-${String(session).replace(/[^A-Za-z0-9_-]/g, '')}.json`);
function readLedger(session) {
  if (!session) return {};
  try { return JSON.parse(readFileSync(ledgerPath(session), 'utf8')); } catch { return {}; }
}
function writeLedger(session, ledger) {
  if (!session) return;
  try { writeFileSync(ledgerPath(session), JSON.stringify(ledger)); } catch { /* a lost ledger costs one repeat, nothing more */ }
}

const keyOf = (f) => `${f.rule}|${f.message}`;
/** The findings in `now` that `prior` does not account for, kind by kind. */
export function newSince(now, prior) {
  const budget = new Map();
  for (const f of prior) budget.set(keyOf(f), (budget.get(keyOf(f)) ?? 0) + 1);
  return now.filter((f) => {
    const n = budget.get(keyOf(f)) ?? 0;
    if (!n) return true;
    budget.set(keyOf(f), n - 1);
    return false;
  });
}

/**
 * @param payload the PostToolUse event Claude Code writes to stdin
 * @returns { text, total } when a changed file has new findings, else null
 */
export function hookResult(payload) {
  const cwd = typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
  const named = payload?.tool_input?.file_path;
  const fromEditor = typeof named === 'string' && RELEVANT.test(named);
  // An Edit or Write names its file. A shell command (cat > file, sed -i, a
  // generator) names nothing, so every changed UI file is a candidate and
  // the ledger decides which ones are new since the hook last looked.
  const candidates = fromEditor
    ? [isAbsolute(named) ? named : resolve(cwd, named)]
    : payload?.tool_name === 'Bash' ? changedFiles(cwd) : [];
  const session = payload?.session_id;
  const ledger = readLedger(session);
  // Warnings are advice, not violations: "this chart paints by hand and the
  // repo has no palette" is worth saying once per file in a session, not
  // after every edit while the agent works on something else in the file
  // (five repeats in one Dub rehearsal, 2026-09-25). Violations repeat
  // until they are fixed.
  const warned = new Set(ledger['\u0000warned'] ?? []);
  // the files this session wrote, for the review at the end of the turn: a
  // file named by an edit, or a file a shell command changed after the
  // session began (uncommitted work already there is the person's, not the
  // agent's)
  const touched = new Set(ledger['\u0000touched'] ?? []);
  const base = ledger['\u0000base'] ?? {};
  const blocks = [];
  let total = 0, knowledge = null;
  for (const abs of candidates) {
    if (!existsSync(abs)) continue;
    const real = realpathSync.native(abs);
    const mtime = statSync(real).mtimeMs;
    if (!fromEditor && ledger[real] === mtime) continue;
    ledger[real] = mtime;
    if (fromEditor || base[real] !== mtime) touched.add(real);
    // The repo is the session's working directory when the file lives under
    // it (the same root the MCP server would be pointed at); a file edited
    // elsewhere is judged against its own repository.
    const under = (root) => root && real.startsWith(realpathSync.native(root) + '/');
    const root = under(cwd) ? cwd : gitTop(dirname(real));
    if (!root) continue;
    const k = knowledge?.root === root ? knowledge : (knowledge = loadKnowledge(root));
    const r = judge(real, root, k, warned);
    if (r) { blocks.push(r.text); total += r.total; }
  }
  ledger['\u0000warned'] = [...warned];
  ledger['\u0000touched'] = [...touched];
  writeLedger(session, ledger);
  if (!blocks.length) return null;
  blocks.push('Fix these now, in the repo\'s own vocabulary as each fix says (a token, a spacing step, a theme path), not by deleting the code. A value that is deliberate stays, with a one-line comment saying why.');
  return { text: blocks.join('\n'), total };
}

/** One file against the system: only what the working copy added since HEAD. */
function judge(real, root, k, warned = new Set(), { violationsOnly = false } = {}) {
  const rel = relative(realpathSync.native(root), real).split('\\').join('/');
  const text = readFileSync(real, 'utf8');
  const before = beforeOf(k, rel);
  const { findings: all, exempt } = validateContent({ text, file: rel, before }, k);
  // an exempt file is judged on duplicates only; with none, there is nothing to say
  if (!all.length) return null;
  // Only what this edit added. A legacy file carries its old findings on
  // every touch; repeating them after each edit is noise, and the review
  // (--check, roast_review) already reports them once at the end. Same rule
  // as the September runs measured by: a finding is new when the file has
  // more of it than the committed version did.
  const fresh = typeof before === 'string' ? newSince(all, validateContent({ text: before, file: rel }, k).findings) : all;
  const findings = fresh.filter((f) => {
    if (f.severity !== 'warning') return true;
    if (violationsOnly) return false;
    const key = `${rel}|${f.rule}|${f.message}`;
    if (warned.has(key)) return false;
    warned.add(key);
    return true;
  });
  if (!findings.length) return null;
  if (violationsOnly) return { rel, findings, exempt, total: findings.length };
  return { text: `Design-system check of ${rel} (roast-my-design-system, the same engine as roast_validate): ${findingLines(findings, k, exempt).join('\n')}`, total: findings.length };
}

/**
 * SessionStart: note the uncommitted UI files that were already there, so the
 * review at the end of a turn never hands the agent someone else's work.
 * Kept for the whole session: a resumed or compacted session keeps its start.
 */
export function sessionStart(payload) {
  const session = payload?.session_id;
  if (!session) return;
  const ledger = readLedger(session);
  if (ledger['\u0000base']) return;
  const cwd = typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
  const base = {};
  for (const abs of changedFiles(cwd)) {
    try { const real = realpathSync.native(abs); base[real] = statSync(real).mtimeMs; } catch { /* gone */ }
  }
  ledger['\u0000base'] = base;
  writeLedger(session, ledger);
}

// Anything but these leaves the review on: it exists so that nobody has to
// remember to ask for it.
const OFF = /^(off|0|false|no)$/i;

/**
 * Stop: the review at the end of the agent's turn. The edit hook tells the
 * agent about drift after each edit, and the agent may carry on regardless
 * (Haiku still shipped it in 1 of 5 runs with the edit hook on, September
 * 2026). This judges every UI file the session changed, keeps the violations
 * that are new since HEAD, and when there are any sends the agent back once to
 * fix them. Warnings never send it back. A second stop in a row always goes
 * through: one extra round, never a loop.
 * @param payload the Stop event Claude Code writes to stdin
 * @returns { text, total } when the agent should go back, else null
 */
export function stopResult(payload, env = process.env) {
  if (OFF.test(String(env.ROAST_STOP_REVIEW ?? ''))) return null;
  if (payload?.stop_hook_active) return null;
  const session = payload?.session_id;
  if (!session) return null;
  const ledger = readLedger(session);
  const touched = ledger['\u0000touched'] ?? [];
  if (!touched.length) return null;
  const cwd = typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
  // A problem is sent back once a session. What the agent kept after that
  // (a deliberate value, commented) is its call, not a loop across turns.
  const sent = new Set(ledger['\u0000sentback'] ?? []);
  const results = [];
  let total = 0, knowledge = null;
  for (const real of touched) {
    if (!existsSync(real)) continue;
    const under = (root) => root && real.startsWith(realpathSync.native(root) + '/');
    const root = under(cwd) ? cwd : gitTop(dirname(real));
    if (!root) continue;
    const k = knowledge?.root === root ? knowledge : (knowledge = loadKnowledge(root));
    const r = judge(real, root, k, new Set(), { violationsOnly: true });
    if (!r) continue;
    const findings = r.findings.filter((f) => !sent.has(`${r.rel}|${f.rule}|${f.message}`));
    if (!findings.length) continue;
    for (const f of findings) sent.add(`${r.rel}|${f.rule}|${f.message}`);
    results.push({ ...r, findings, total: findings.length });
    total += findings.length;
  }
  if (!total) return null;
  ledger['\u0000sentback'] = [...sent];
  writeLedger(session, ledger);
  const L = [`Before you finish: the design-system review (roast-my-design-system) found ${total} problem${total === 1 ? '' : 's'} in what this session added to ${results.length} file${results.length === 1 ? '' : 's'}.`];
  for (const r of results.slice(0, 10)) {
    L.push(`${r.rel}:`);
    for (const f of r.findings.slice(0, 8)) L.push(`  ✕ L${f.line} ${f.message}${f.fix ? `\n     Fix: ${f.fix}` : ''}`);
    if (r.findings.length > 8) L.push(`  (+${r.findings.length - 8} more in this file)`);
  }
  if (results.length > 10) L.push(`(+${results.length - 10} more files)`);
  L.push('Fix these in the repo\'s own vocabulary, as each fix says (a token, a spacing step, a theme path, the existing component), then finish. A value that is deliberate stays, with a one-line comment saying why; say so in your reply.');
  return { text: L.join('\n'), total };
}
