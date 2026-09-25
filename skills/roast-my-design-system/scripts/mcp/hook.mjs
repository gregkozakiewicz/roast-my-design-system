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
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { validateContent } from './engine.mjs';
import { loadKnowledge } from './knowledge.mjs';
import { RELEVANT, beforeOf, findingLines } from './tools.mjs';

const gitTop = (dir) => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
};

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
 * @returns { text, total } when the edited file has new findings, else null
 */
export function hookResult(payload) {
  const file = payload?.tool_input?.file_path;
  if (typeof file !== 'string' || !RELEVANT.test(file)) return null;
  const cwd = typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
  const abs = isAbsolute(file) ? file : resolve(cwd, file);
  if (!existsSync(abs)) return null;

  // The repo is the session's working directory when the file lives under
  // it (the same root the MCP server would be pointed at); a file edited
  // elsewhere is judged against its own repository.
  const real = realpathSync.native(abs);
  const under = (root) => root && real.startsWith(realpathSync.native(root) + '/');
  const root = under(cwd) ? cwd : gitTop(dirname(real));
  if (!root) return null;

  const k = loadKnowledge(root);
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
  const findings = typeof before === 'string' ? newSince(all, validateContent({ text: before, file: rel }, k).findings) : all;
  if (!findings.length) return null;
  const L = [`Design-system check of ${rel} (roast-my-design-system, the same engine as roast_validate): ${findingLines(findings, k).join('\n')}`];
  L.push('Fix these now, in the repo\'s own vocabulary as each fix says (a token, a spacing step, a theme path), not by deleting the code. A value that is deliberate stays, with a one-line comment saying why.');
  return { text: L.join('\n'), total: findings.length };
}
