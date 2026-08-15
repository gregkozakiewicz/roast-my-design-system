#!/usr/bin/env node
/**
 * roast-my-design-system — npx entrypoint. Runs the same deterministic,
 * zero-dependency scanner the Claude Code skill uses: harvest the repo,
 * diagnose it against Ideal Design System norms and the 29-repo benchmark,
 * write design-system-roast.html, open it, print the score.
 *
 *   npx roast-my-design-system [path] [--theme dark|light] [--out report.html] [--no-open]
 *                              [--rules] [--json]
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

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
                  AGENTS.md, .cursorrules, .cursor/rules/) inside a marked
                  block; re-running replaces only that block
  --card          also write roast-card.svg: a shareable 1200x630 card with
                  the score and worst findings (pure SVG, embeds in READMEs)
  --sarif         also write design-system-roast.sarif for GitHub code
                  scanning: findings annotated on files in the Security tab
  --json          print the scan summary as JSON on stdout (implies --no-open)

Read-only scan (--apply and --rules write only the files they name).
No network, no telemetry, nothing leaves your machine.`);
  process.exit(0);
}

const wantRules = flag('rules') === true;
const wantApply = flag('apply') === true;
const wantCard = flag('card') === true;
const wantSarif = flag('sarif') === true;
const asJson = flag('json') === true;
const noOpen = flag('no-open') === true || asJson;
const theme = opt('theme', 'dark');
const target = resolve(argv.find((a) => !a.startsWith('--')) || process.cwd());
if (!existsSync(target) || !statSync(target).isDirectory()) {
  console.error(`Not a directory: ${target}`);
  process.exit(1);
}
const outPath = resolve(opt('out', join(target, 'design-system-roast.html')));

const tmp = mkdtempSync(join(tmpdir(), 'roast-'));
const harvestPath = join(tmp, 'harvest.json');
const summaryPath = join(tmp, 'summary.json');

function run(script, args) {
  // --json keeps stdout clean for the JSON payload; child chatter is dropped
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), ...args], { stdio: asJson ? 'ignore' : 'inherit' });
  if (r.status !== 0) {
    rmSync(tmp, { recursive: true, force: true });
    process.exit(r.status ?? 1);
  }
}
const say = (s) => { if (!asJson) console.log(s); };

say(`roast-my-design-system ${VERSION} · read-only scan, nothing leaves your machine\n`);
run('harvest/index.mjs', [target, '--out', harvestPath]);
say('');
run('diagnose/index.mjs', [harvestPath, '--out', outPath, '--theme', theme, '--summary', summaryPath]);

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
