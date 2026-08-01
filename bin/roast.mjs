#!/usr/bin/env node
/**
 * roast-my-design-system — npx entrypoint. Runs the same deterministic,
 * zero-dependency scanner the Claude Code skill uses: harvest the repo,
 * diagnose it against Ideal Design System norms and the 29-repo benchmark,
 * write design-system-roast.html, open it, print the score.
 *
 *   npx roast-my-design-system [path] [--theme dark|light] [--out report.html] [--no-open]
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

Read-only scan. No network, no telemetry, nothing leaves your machine.`);
  process.exit(0);
}

const noOpen = flag('no-open') === true;
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
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), ...args], { stdio: 'inherit' });
  if (r.status !== 0) {
    rmSync(tmp, { recursive: true, force: true });
    process.exit(r.status ?? 1);
  }
}

console.log(`roast-my-design-system ${VERSION} · read-only scan, nothing leaves your machine\n`);
run('harvest/index.mjs', [target, '--out', harvestPath]);
console.log('');
run('diagnose/index.mjs', [harvestPath, '--out', outPath, '--theme', theme, '--summary', summaryPath]);

let summary = null;
try { summary = JSON.parse(readFileSync(summaryPath, 'utf8')); } catch { /* report still exists */ }
rmSync(tmp, { recursive: true, force: true });

if (summary) {
  const bad = summary.tiles.filter((t) => t.health === 'bad');
  if (bad.length) {
    console.log(`\n  worst offenders: ${bad.map((t) => `${t.value} ${t.label}`).join(' · ')}`);
  }
}

console.log(`\nWant the fixes, not just the roast? The free Claude Code skill runs this same
scan, then walks the punch list with you: https://github.com/pencilrebel/roast-my-design-system`);

if (!noOpen) {
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  spawnSync(opener, [outPath], { stdio: 'ignore', shell: process.platform === 'win32' });
}
