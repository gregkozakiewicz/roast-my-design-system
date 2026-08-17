#!/usr/bin/env node
/**
 * roast-my-design-system — npx entrypoint. Runs the same deterministic,
 * zero-dependency scanner the Claude Code skill uses: harvest the repo,
 * diagnose it against Ideal Design System norms and the 29-repo benchmark,
 * write design-system-roast.html, open it, print the score.
 *
 *   npx roast-my-design-system [path] [--theme dark|light] [--out report.html] [--no-open]
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

Usage: npx roast-my-design-system [path] [options]

  path            repo to scan (default: current directory)
  --theme <t>     dark | light (default: dark)
  --out <file>    report path (default: design-system-roast.html in the repo)
  --no-open       write the report without opening it
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
  --by <name>     put a requester credit in the report header, next to the
                  scan date ("commissioned by <name>")
  --exclude <p>   leave a folder out of the scan (repo-relative, e.g.
                  --exclude lab/ --exclude piglet/ or --exclude lab/,piglet/;
                  same as listing it in a .roastignore file at the repo root).
                  Every exclusion is printed in the report header with the
                  number of files it removed, so a scoped scan says so
  --json          print the scan summary as JSON on stdout (implies --no-open)
  --check         check the working tree's changed files (git diff + untracked)
                  against the design system and print the findings; exits 1
                  when something is over the line, so it composes with scripts
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
const noOpen = flag('no-open') === true || asJson;
const theme = opt('theme', 'dark');
const commissionedBy = opt('by', null);
const excludes = optAll('exclude');
const target = resolve(argv.find((a) => !a.startsWith('--')) || process.cwd());
if (!existsSync(target) || !statSync(target).isDirectory()) {
  console.error(`Not a directory: ${target}`);
  process.exit(1);
}
const outPath = resolve(opt('out', join(target, 'design-system-roast.html')));

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
// the harvest goes to a temp dir this wrapper deletes right after; tell the
// script so it does not print a path that will be gone seconds later
run('harvest/index.mjs', [target, '--out', harvestPath,
  ...excludes.flatMap((e) => ['--exclude', e])], { ROAST_EPHEMERAL_OUT: '1' });
say('');
run('diagnose/index.mjs', [harvestPath, '--out', outPath, '--theme', theme, '--summary', summaryPath,
  ...(commissionedBy ? ['--by', commissionedBy] : [])]);

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
scan, then walks the punch list with you: https://github.com/pencilrebel/roast-my-design-system`);

if (!noOpen) {
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
