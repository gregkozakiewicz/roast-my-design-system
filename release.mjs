#!/usr/bin/env node
/**
 * The one release path. Everything else is wrong.
 *
 *   node release.mjs 5.1.2            cut the release
 *   node release.mjs 5.1.2 --dry-run  do everything except commit, tag and push
 *   node release.mjs --check          verify the working tree is release-ready
 *
 * HOW A RELEASE ACTUALLY WORKS HERE, so no future session guesses:
 *
 *   npm is published BY GITHUB, never from a laptop. Pushing a v* tag starts
 *   .github/workflows/publish.yml, which re-runs the tests, publishes to npm
 *   with trusted publishing (no tokens, provenance attached) and then publishes
 *   server.json to the official MCP registry. Running `npm publish` by hand
 *   bypasses the tests, loses the provenance badge and leaves the registry
 *   stale. Do not do it. This script never does it either.
 *
 * What this script owns: the version lives in four files plus server.json's
 * package block, the changelog needs an entry, the suite has to pass, and the
 * tag has to match. Miss one and the release is either blocked by CI or, worse,
 * ships half-synced. So it is one command with the whole checklist inside.
 *
 *   1. refuses to start unless the tree is clean-ish and you are on main
 *   2. writes the version into every place that carries it
 *   3. demands a changelog entry for it
 *   4. runs the smoke test and the 55-check snapshot suite locally
 *   5. shows you the diff and waits for a typed yes
 *   6. commits, tags, pushes
 *   7. watches the GitHub run and confirms npm and the registry actually have it
 */
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const ROOT = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const CHECK_ONLY = argv.includes('--check');
const ASSUME_YES = argv.includes('--yes');
const version = argv.find((a) => /^\d+\.\d+\.\d+/.test(a));

const say = (m) => console.log(m);
const step = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`);
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const die = (m) => {
  console.error(`\n\x1b[31m✗ ${m}\x1b[0m\n`);
  process.exit(1);
};

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const run = (cmd) => spawnSync(cmd, { cwd: ROOT, shell: true, stdio: 'inherit' }).status === 0;

// Every file that carries the version. Adding a new one? Add it here, or the
// next release ships with two versions disagreeing in public.
const CARRIERS = [
  { file: 'package.json', find: /("version":\s*")[^"]+(")/, label: 'npm package' },
  { file: 'skills/roast-my-design-system/scripts/lib/version.mjs', find: /(export const VERSION = ')[^']+(')/, label: 'engine constant (report footer, rules header)' },
  { file: '.claude-plugin/plugin.json', find: /("version":\s*")[^"]+(")/, label: 'Claude Code plugin manifest' },
];

const PKG = () => JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

// ---------- 1. preflight ----------

step('Preflight');

if (!existsSync(join(ROOT, 'package.json'))) die('run this from the repo root');

const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (branch !== 'main') die(`you are on ${branch}. Releases go out from main.`);
ok('on main');

const behind = git('rev-list', '--count', 'HEAD..@{u}').trim();
if (behind !== '0') die(`main is ${behind} commit(s) behind the remote. Pull first.`);
ok('up to date with origin');

if (CHECK_ONLY) {
  const dirty = git('status', '--porcelain');
  say(dirty ? `\nUncommitted changes:\n${dirty}` : '\nWorking tree clean.');
  say(`\nCurrent version: ${PKG().version}`);
  process.exit(0);
}

if (!version) die('give me the version: node release.mjs 5.1.2');
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) die(`"${version}" is not a semver version`);

// Compare against the last commit, not the working tree: a dry run leaves the
// bump written to disk, and re-running for real must not trip over its own
// earlier pass.
const current = JSON.parse(git('show', 'HEAD:package.json')).version;
if (version === current) die(`${version} is already the released version. Bump to something new.`);
ok(`${current} → ${version}${PKG().version === version ? ' (already written to disk, likely a dry run)' : ''}`);

const tags = git('tag', '--list', `v${version}`);
if (tags) die(`tag v${version} already exists. Versions are never reused: npm rejects a republished version.`);
ok(`tag v${version} is free`);

// ---------- 2. write the version everywhere ----------

step('Syncing the version');

for (const c of CARRIERS) {
  const path = join(ROOT, c.file);
  if (!existsSync(path)) die(`missing ${c.file} — the release checklist is out of date with the repo`);
  const before = readFileSync(path, 'utf8');
  if (!c.find.test(before)) die(`could not find the version line in ${c.file}`);
  writeFileSync(path, before.replace(c.find, `$1${version}$2`));
  ok(`${c.file} — ${c.label}`);
}

// server.json carries the version twice: the server's own version and the npm
// package it points at. The MCP registry rejects a package version that is not
// on npm, so both must equal the version we are about to publish.
const serverPath = join(ROOT, 'server.json');
if (existsSync(serverPath)) {
  const server = JSON.parse(readFileSync(serverPath, 'utf8'));
  server.version = version;
  for (const p of server.packages || []) if (p.registryType === 'npm') p.version = version;
  writeFileSync(serverPath, JSON.stringify(server, null, 2) + '\n');
  ok('server.json — MCP registry listing (server version and npm package version)');

  const pkg = PKG();
  if (pkg.mcpName !== server.name) {
    die(`package.json mcpName (${pkg.mcpName}) does not match server.json name (${server.name}). The registry checks one against the other and will refuse the publish.`);
  }
  ok('mcpName matches the registry listing name');
}

// ---------- 2b. is the vendored engine actually current? ----------

// proffer-2 is the engine's source of truth; this repo ships a vendored copy.
// If the two have drifted, someone edited the engine and forgot to sync, and
// the release would ship yesterday's scanner. Only checkable when proffer-2 is
// sitting next to this repo, so it warns rather than blocks.
step('Vendored engine');

const SRC = join(ROOT, '..', 'proffer-2', 'src');
if (existsSync(SRC)) {
  // proffer-2's own tooling never gets vendored, so it is not drift.
  const notShipped = ['sync-skill.mjs', 'release-check.mjs', 'verify-provenance.mjs', 'build.mjs', 'build-refs.mjs', 'repos.txt'];
  const drift = spawnSync('diff', ['-rq', ...notShipped.flatMap((f) => ['-x', f]), SRC, join(ROOT, 'skills/roast-my-design-system/scripts')], { encoding: 'utf8' }).stdout.trim();
  if (drift) {
    say(`\x1b[33m  proffer-2/src and the vendored scripts/ differ:\x1b[0m`);
    say(drift.split('\n').map((l) => `    ${l}`).join('\n'));
    say(`\x1b[33m  Run sync-skill in proffer-2 first if the engine changed.\x1b[0m`);
  } else ok('vendored engine matches proffer-2/src');
} else say('  proffer-2 not found next to this repo, skipping the drift check');

// ---------- 3. the changelog is not optional ----------

step('Changelog');

const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
if (!new RegExp(`^## ${version.replace(/\./g, '\\.')}\\s`, 'm').test(changelog)) {
  die(`CHANGELOG.md has no "## ${version}" section. Write it before releasing: the changelog is what the next person reads to understand what moved.`);
}
ok(`"## ${version}" section present`);

// ---------- 4. the same gates CI will run ----------

step('Tests (the same ones the publish workflow runs)');

if (!run('node bin/roast.mjs . --no-open --out /tmp/self-roast.html')) die('smoke test failed: the CLI cannot roast its own repo');
ok('smoke test');

if (!run('node tests/run.mjs')) die('snapshot suite failed. A score, tile, verdict, rule or exclusion moved. Read the diff before you touch the expected files.');
ok('snapshot suite');

// ---------- 5. show the damage, then ask ----------

step('What is about to be committed');

execFileSync('git', ['--no-pager', 'diff'], { cwd: ROOT, stdio: 'inherit' });
const untracked = git('ls-files', '--others', '--exclude-standard');
if (untracked) say(`\nNew files:\n${untracked}`);

if (DRY) {
  say(`\n\x1b[33mDry run: files are written, nothing is committed.\x1b[0m`);
  say(`Undo with: git checkout -- . \n`);
  process.exit(0);
}

// The landing page has gone stale before (v3.7.1 through v3.10.1, caught by
// Greg, not by any check). Nothing can verify prose automatically, so this asks
// out loud rather than letting it slip again.
if (!ASSUME_YES) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  say(`\n  If this release changes anything a user can see, these need to say so too:`);
  say(`    docs/index.html   the landing page`);
  say(`    README.md         including the screenshots, if the report's visuals moved`);
  const checked = await rl.question(`  Both current for ${version}? [y/N] `);
  if (!/^y(es)?$/i.test(checked.trim())) {
    rl.close();
    die('update them first. The version files stay written; re-run when the copy is ready.');
  }

  const answer = await rl.question(`\nPush v${version}? This publishes to npm and the MCP registry. Type the version to confirm: `);
  rl.close();
  if (answer.trim() !== version) die('not confirmed, nothing pushed');
}

// ---------- 6. commit, tag, push ----------

step('Pushing');

execFileSync('git', ['add', '-A'], { cwd: ROOT, stdio: 'inherit' });
const summary = (changelog.split(`## ${version}`)[1] || '').split('\n').find((l) => l.trim().startsWith('-')) || '';
const headline = summary.replace(/^-\s*/, '').replace(/\*\*/g, '').split('.')[0].trim().slice(0, 80);
execFileSync('git', ['commit', '-m', `${version}: ${headline || 'release'}`], { cwd: ROOT, stdio: 'inherit' });
ok('committed');

execFileSync('git', ['tag', `v${version}`], { cwd: ROOT, stdio: 'inherit' });
execFileSync('git', ['push', 'origin', 'main'], { cwd: ROOT, stdio: 'inherit' });
execFileSync('git', ['push', 'origin', `v${version}`], { cwd: ROOT, stdio: 'inherit' });
ok(`pushed main and v${version}`);

// ---------- 7. watch it land ----------

step('GitHub is publishing (npm, then the MCP registry)');

say('  Watching the run. Ctrl-C is safe: the workflow keeps going without you.\n');
const hasGh = spawnSync('gh', ['--version'], { stdio: 'ignore' }).status === 0;
if (hasGh) {
  execSync('sleep 6', { stdio: 'ignore' }); // give GitHub a moment to register the run
  run(`gh run watch --exit-status $(gh run list --workflow=publish.yml --limit 1 --json databaseId --jq '.[0].databaseId')`);
} else {
  say('  gh CLI not installed, so no live view. Check:');
  say('  https://github.com/pencilrebel/roast-my-design-system/actions\n');
}

step('Verifying what the world can see');

const npmVersion = spawnSync('npm', ['view', `roast-my-design-system@${version}`, 'version'], { encoding: 'utf8' }).stdout.trim();
npmVersion === version ? ok(`npm serves ${version}`) : say(`  \x1b[33m…npm does not serve ${version} yet. It can lag a minute; re-check with: npm view roast-my-design-system version\x1b[0m`);

if (existsSync(serverPath)) {
  const name = JSON.parse(readFileSync(serverPath, 'utf8')).name;
  const res = spawnSync('curl', ['-s', `https://registry.modelcontextprotocol.io/v0.1/servers?search=${name}`], { encoding: 'utf8' }).stdout;
  res.includes(`"version":"${version}"`) || res.includes(`"version": "${version}"`)
    ? ok(`MCP registry serves ${version}`)
    : say(`  \x1b[33m…MCP registry not updated yet. Re-check with: curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=${name}"\x1b[0m`);
}

// ---------- 8. the two surfaces GitHub shows, which keep going stale ----------

if (hasGh) {
  step('GitHub release and repo description');

  // Release notes are the changelog section, verbatim. One source, no retyping.
  const section = changelog.slice(changelog.indexOf(`## ${version}`));
  const notes = section.slice(0, section.indexOf('\n## ', 3)).split('\n').slice(1).join('\n').trim();
  const madeRelease = spawnSync('gh', ['release', 'create', `v${version}`, '--title', `v${version}`, '--notes', notes], { cwd: ROOT, encoding: 'utf8' });
  madeRelease.status === 0 ? ok(`release v${version} created`) : say(`  \x1b[33m…release not created: ${(madeRelease.stderr || '').trim()}\x1b[0m`);

  // The repo description carries a version prefix that drifts every time it is
  // updated by hand. Swap just the prefix, keep the pitch, respect the 350 cap.
  const desc = spawnSync('gh', ['repo', 'view', '--json', 'description', '--jq', '.description'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
  if (desc) {
    const next = /^v\d+\.\d+\.\d+/.test(desc) ? desc.replace(/^v\d+\.\d+\.\d+/, `v${version}`) : `v${version} · ${desc}`;
    if (next === desc) ok('repo description already current');
    else if (next.length > 350) say(`  \x1b[33m…description would be ${next.length} chars, over GitHub's 350. Trim it by hand.\x1b[0m`);
    else {
      const set = spawnSync('gh', ['repo', 'edit', '--description', next], { cwd: ROOT, encoding: 'utf8' });
      set.status === 0 ? ok(`repo description now reads v${version}`) : say(`  \x1b[33m…description not updated: ${(set.stderr || '').trim()}\x1b[0m`);
    }
  }
}

say(`\n\x1b[32m${version} is out.\x1b[0m`);
say(`  npm       https://www.npmjs.com/package/roast-my-design-system`);
say(`  release   https://github.com/pencilrebel/roast-my-design-system/releases/tag/v${version}`);
say(`  registry  https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.pencilrebel`);
say(`\n  Still yours to do: push proffer-2 if the engine changed there, and refresh the installed skill.\n`);
