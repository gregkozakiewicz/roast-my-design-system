#!/usr/bin/env node
/**
 * roast-my-design-system — npx entrypoint. Runs the same deterministic,
 * zero-dependency scanner the Claude Code skill uses: harvest the repo,
 * diagnose it against Ideal Design System norms and the 29-repo benchmark,
 * write design-system-roast.html, open it, print the score.
 *
 *   npx roast-my-design-system@latest [path] [--theme dark|light] [--out report.html] [--no-open]
 *                              [--rules] [--json] [--exclude <path>]
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(HERE, '../skills/roast-my-design-system/scripts');
const VERSION = JSON.parse(readFileSync(join(HERE, '../package.json'), 'utf8')).version;

const argv = process.argv.slice(2);
function flag(name) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return null;
  argv.splice(i, 1);
  return true;
}
function opt(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1 || !argv[i + 1]) return fallback;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
}
// repeatable two-argument option: collects every "--name <a> <b>" pair
function optPairs(name) {
  const out = [];
  let i;
  while ((i = argv.indexOf(`--${name}`)) !== -1) {
    const a = argv[i + 1], b = argv[i + 2];
    if (!a || !b || a.startsWith('--') || b.startsWith('--')) {
      console.error(`--${name} needs a title and a file: --${name} "Interaction audit" audit.md`);
      process.exit(1);
    }
    out.push([a, b]);
    argv.splice(i, 3);
  }
  return out;
}
// repeatable option: collects every occurrence, comma-separated values split
function optAll(name) {
  const out = [];
  let v;
  while ((v = opt(name, null)) !== null) {
    out.push(...v.split(',').map((s) => s.trim()).filter(Boolean));
  }
  return out;
}

if (flag('version') || flag('v')) { console.log(VERSION); process.exit(0); }
if (flag('help') || flag('h')) {
  console.log(`roast-my-design-system ${VERSION}

Usage: npx roast-my-design-system@latest [path] [options]

Run it yourself

  path            repo to scan (default: current directory)
  --theme <t>     dark | light (default: dark)
  --out <file>    report path (default: design-system-roast.html in the repo)
  --no-open       write the report without opening it
  --open          open it even when the output is piped or an agent is running
  --rules         also write design-system-rules.md: agent rules (for
                  CLAUDE.md / .cursor/rules) generated from the scan
  --apply         inject the rules straight into your agent files (CLAUDE.md,
                  AGENTS.md, .cursorrules, .cursor/rules/, .windsurfrules,
                  .github/copilot-instructions.md) inside a marked block;
                  re-running replaces only that block. Windsurf and Copilot
                  get a compact variant sized for their limits
  --card          also write roast-card.svg: a shareable 1200x630 card with
                  the score and worst findings (pure SVG, embeds in READMEs)
  --sarif         also write design-system-roast.sarif for GitHub code
                  scanning: findings annotated on files in the Security tab
  --by <name>     put a name in the report header, for when you ran it for
                  someone else ("commissioned by <name>")
  --exclude <p>   leave a folder out of the scan (repo-relative, e.g.
                  --exclude lab/ --exclude piglet/ or --exclude lab/,piglet/;
                  same as listing it in a .roastignore file at the repo root).
                  Every exclusion is printed in the report header with the
                  number of files it removed, so a scoped scan says so
  --json          print the scan summary as JSON on stdout (implies --no-open)
  --check         check the working tree's changed files (git diff + untracked)
                  against the design system and print the findings; exits 1
                  when something is over the line, so it composes with scripts

For your agent (a plain terminal has no agent to write these)

  --notes <file>  the agent's read of this scan, embedded in the report as
                  "What the numbers mean", labelled as written by AI and kept
                  apart from the measured numbers. The Claude Code skill
                  writes and passes this automatically
  --section "Title" <file>
                  a further agent-written chapter after the notes, same
                  markdown-lite plus "## " sub-headings, same label.
                  Repeatable, one chapter per --section
  --mcp           run as a local MCP server (stdio) so your agent can query
                  the design system live: context, canonical components,
                  tokens, validation. Add to your client, e.g. Claude Code:
                  claude mcp add roast -- npx roast-my-design-system --mcp

Read-only scan (--apply and --rules write only the files they name).
No network, no telemetry, nothing leaves your machine.`);
  process.exit(0);
}

// ---------- MCP server / --check: the live faces, no report pipeline ----------
if (argv.includes('--mcp')) {
  argv.splice(argv.indexOf('--mcp'), 1);
  const root = resolve(argv.find((a) => !a.startsWith('--')) || process.cwd());
  // stdout belongs to the protocol from here on — no banner, no chatter
  const { serve } = await import(pathToFileURL(join(SCRIPTS, 'mcp/server.mjs')).href);
  serve(root);
  // the server owns the process now; readline keeps it alive until the client
  // closes stdin, and nothing below (the report pipeline) may run
  await new Promise(() => {});
} else if (argv.includes('--check')) {
  argv.splice(argv.indexOf('--check'), 1);
  const root = resolve(argv.find((a) => !a.startsWith('--')) || process.cwd());
  const { loadKnowledge } = await import(pathToFileURL(join(SCRIPTS, 'mcp/knowledge.mjs')).href);
  const { reviewData } = await import(pathToFileURL(join(SCRIPTS, 'mcp/tools.mjs')).href);
  console.log(`roast-my-design-system ${VERSION} · --check · read-only, nothing leaves your machine\n`);
  const { text, total } = reviewData(loadKnowledge(root));
  console.log(text);
  process.exit(total ? 1 : 0);
}

const wantRules = flag('rules') === true;
const wantApply = flag('apply') === true;
const wantCard = flag('card') === true;
const wantSarif = flag('sarif') === true;
const asJson = flag('json') === true;
// Opening a browser tab is a courtesy to a person watching a terminal. When
// an agent runs the scan (Claude Code, Cursor, Codex) it captures stdout, so
// there is no terminal and no one to look — and an agent verifying a fix runs
// this repeatedly, throwing a tab in the user's face each time (Greg, working
// through the fix loop, 2026-09-10). No TTY, no tab. `--open` forces it back
// for anyone piping output who still wants the report.
const interactive = process.stdout.isTTY === true && !process.env.CI;
const forceOpen = flag('open') === true;
// flag() consumes the argument, so ask once and keep the answer.
const askedNoOpen = flag('no-open') === true;
const noOpen = askedNoOpen || asJson;
const theme = opt('theme', 'dark');
const commissionedBy = opt('by', null);
const notesFile = opt('notes', null);
const sections = optPairs('section');
const excludes = optAll('exclude');
// Reject an unreadable --notes / --section before scanning, not after: the
// scan is the expensive part, and dying on a flag once the work is done is
// the rudest possible order (Greg watched it happen, 2026-09-10). diagnose
// checks these too; this is the early door with the same words.
for (const [flagName, file] of [
  ...(notesFile ? [['--notes', notesFile]] : []),
  ...sections.map(([, f]) => ['--section', f]),
]) {
  if (existsSync(resolve(file))) continue;
  console.error(`${flagName}: cannot read ${file}
  ${flagName} is for an agent to pass: the file holds its writing about this
  scan, which the report embeds. Running by hand? Leave the flag off, or use
  the Claude Code skill, which writes it for you.`);
  process.exit(1);
}

// Every value-taking flag is consumed before the path is looked for, so
// `--out report.html .` no longer reads report.html as the repo (it did,
// until 6.0.1: flags in the "wrong" order died with "Not a directory").
const outOpt = opt('out', null);
const target = resolve(argv.find((a) => !a.startsWith('--')) || process.cwd());
if (!existsSync(target) || !statSync(target).isDirectory()) {
  console.error(`Not a directory: ${target}`);
  process.exit(1);
}
const outPath = resolve(outOpt ?? join(target, 'design-system-roast.html'));

const tmp = mkdtempSync(join(tmpdir(), 'roast-'));
const harvestPath = join(tmp, 'harvest.json');
const summaryPath = join(tmp, 'summary.json');

function run(script, args, env) {
  // --json keeps stdout clean for the JSON payload; child chatter is dropped
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), ...args],
    { stdio: asJson ? 'ignore' : 'inherit', ...(env ? { env: { ...process.env, ...env } } : {}) });
  if (r.status !== 0) {
    rmSync(tmp, { recursive: true, force: true });
    process.exit(r.status ?? 1);
  }
}
const say = (s) => { if (!asJson) console.log(s); };

say(`roast-my-design-system ${VERSION} · read-only scan, nothing leaves your machine`);
// The score this repo had last time, read from the report about to be
// overwritten. It decides whether a browser tab is worth throwing at anyone:
// an agent working a fix runs the scan repeatedly, and only the run that
// actually moves the number is worth looking at.
let previousScore = null;
try {
  const prev = readFileSync(outPath, 'utf8').match(/<!-- rmds-score: (\d+|na) -->/);
  if (prev) previousScore = prev[1];
} catch { /* no previous report: this is the first look, so it is worth opening */ }

// the harvest goes to a temp dir this wrapper deletes right after; tell the
// script so it does not print a path that will be gone seconds later
run('harvest/index.mjs', [target, '--out', harvestPath,
  ...excludes.flatMap((e) => ['--exclude', e])], { ROAST_EPHEMERAL_OUT: '1' });
say('');
run('diagnose/index.mjs', [harvestPath, '--out', outPath, '--theme', theme, '--summary', summaryPath,
  ...(commissionedBy ? ['--by', commissionedBy] : []),
  ...(notesFile ? ['--notes', resolve(notesFile)] : []),
  ...sections.flatMap(([title, file]) => ['--section', title, resolve(file)])]);

// The verdict leads, the evidence follows: harvest details print here, after
// the diagnosis, rendered from harvest.json via the same lines the direct
// harvest run uses.
if (!asJson) {
  try {
    const harvestData = JSON.parse(readFileSync(harvestPath, 'utf8'));
    const { detailLines } = await import(pathToFileURL(join(SCRIPTS, 'harvest/summary.mjs')).href);
    console.log('');
    for (const l of detailLines(harvestData)) console.log(l);
    console.log(`\n  scanned in ${harvestData.tookMs}ms`);
  } catch { /* details are garnish; the report exists either way */ }
}

const rulesPath = resolve(join(target, 'design-system-rules.md'));
if (wantRules) {
  say('');
  run('rules/index.mjs', [harvestPath, '--out', rulesPath]);
}
if (wantApply) {
  say('');
  run('rules/apply.mjs', [harvestPath, '--target', target]);
}
const cardPath = resolve(join(target, 'roast-card.svg'));
if (wantCard) {
  say('');
  run('card/index.mjs', [summaryPath, '--out', cardPath]);
}
const sarifPath = resolve(join(target, 'design-system-roast.sarif'));
if (wantSarif) {
  say('');
  run('sarif/index.mjs', [harvestPath, '--out', sarifPath]);
}

let summary = null;
try { summary = JSON.parse(readFileSync(summaryPath, 'utf8')); } catch { /* report still exists */ }
rmSync(tmp, { recursive: true, force: true });

if (asJson) {
  console.log(JSON.stringify({ ...(summary ?? { report: outPath }), ...(wantRules ? { rules: rulesPath } : {}) }, null, 2));
} else if (summary) {
  const bad = summary.tiles.filter((t) => t.health === 'bad');
  if (bad.length) {
    console.log(`\n  worst offenders: ${bad.map((t) => `${t.value} ${t.label}`).join(' · ')}`);
  }
}

if (wantApply && !asJson) {
  console.log(`\n  rules are in place: your agent reads them on its next run.`);
} else if (wantRules && !asJson) {
  console.log(`\n  design-system-rules.md is ready: paste it into CLAUDE.md or .cursor/rules
  so your AI agent stops repeating this repo's mistakes. Or run --apply
  next time and skip the paste.`);
} else if (!asJson) {
  console.log(`\n  there is a present wrapped inside the report: your agent rules file,
  generated from this scan. Or run with --rules to write it straight to disk.`);
}

say(`\nWant the fixes, not just the roast? The free Claude Code skill runs this same
scan, then walks the punch list with you: https://github.com/gregkozakiewicz/roast-my-design-system`);

// The ask for feedback, worded and linked in one place (scripts/lib/feedback.mjs)
// so the terminal and the report footer can never say different things.
if (!asJson) {
  const { feedbackUrl, FEEDBACK_ASK, FEEDBACK_CTA, STAR_ASK, STAR_CTA, STAR_URL } = await import(pathToFileURL(join(SCRIPTS, 'lib/feedback.mjs')).href);
  say(`\n${FEEDBACK_ASK} ${FEEDBACK_CTA}:\n${feedbackUrl(VERSION)}\n${STAR_ASK} ${STAR_CTA}:\n${STAR_URL}`);
}

// A person at a terminal asked for this, so they get the report. An agent
// did not: it gets the tab only when the number moved, which is the moment
// worth seeing (Greg, working a fix loop through Claude Code, 2026-09-10 —
// several windows opened while the agent was still working).
// `summary` was parsed before the temp dir was removed; reading the file
// here would find nothing.
const currentScore = summary?.score === undefined || summary?.score === null ? null : String(summary.score);
const scoreMoved = previousScore === null || (currentScore !== null && currentScore !== previousScore);
const quietRun = !interactive && !forceOpen && !scoreMoved;
if (quietRun && !asJson && !askedNoOpen) {
  console.log(`\n  (score unchanged at ${currentScore ?? '?'}, so no browser tab. Add --open if you want one.)`);
}

if (!noOpen && !quietRun) {
  // Windows: `start` treats a first quoted arg as the window TITLE, and Node
  // quotes paths containing spaces — pass an empty title so the path lands
  // in the file slot. Linux: xdg-open may be absent (headless, WSL); the
  // report path is already printed above, so a failed open is harmless.
  if (process.platform === 'win32') {
    spawnSync('cmd', ['/c', 'start', '', outPath], { stdio: 'ignore' });
  } else {
    spawnSync(process.platform === 'darwin' ? 'open' : 'xdg-open', [outPath], { stdio: 'ignore' });
  }
}
