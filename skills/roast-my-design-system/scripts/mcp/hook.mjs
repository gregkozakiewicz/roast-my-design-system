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
  const blocks = [];
  let total = 0, knowledge = null;
  for (const abs of candidates) {
    if (!existsSync(abs)) continue;
    const real = realpathSync.native(abs);
    const mtime = statSync(real).mtimeMs;
    if (!fromEditor && ledger[real] === mtime) continue;
    ledger[real] = mtime;
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
  writeLedger(session, ledger);
  if (!blocks.length) return null;
  blocks.push('Fix these now, in the repo\'s own vocabulary as each fix says (a token, a spacing step, a theme path), not by deleting the code. A value that is deliberate stays, with a one-line comment saying why.');
  return { text: blocks.join('\n'), total };
}

/** One file against the system: only what the working copy added since HEAD. */
function judge(real, root, k, warned = new Set()) {
  const rel = relative(realpathSync.native(root), real).split('\\').join('/');
  const text = readFileSync(real, 'utf8');
  const before = beforeOf(k, rel);
  const { findings: all, exempt } = validateContent({ text, file: rel, before }, k);
  if (exempt || !all.length) return null;
  // Only what this edit added. A legacy file carries its old findings on
  // every touch; repeating them after each edit is noise, and the review
  // (--check, roast_review) already reports them once at the end. Same rule
  // as the September runs measured by: a finding is new when the file has
  // more of it than the committed version did.
  const fresh = typeof before === 'string' ? newSince(all, validateContent({ text: before, file: rel }, k).findings) : all;
  const findings = fresh.filter((f) => {
    if (f.severity !== 'warning') return true;
    const key = `${rel}|${f.rule}|${f.message}`;
    if (warned.has(key)) return false;
    warned.add(key);
    return true;
  });
  if (!findings.length) return null;
  return { text: `Design-system check of ${rel} (roast-my-design-system, the same engine as roast_validate): ${findingLines(findings, k).join('\n')}`, total: findings.length };
}
