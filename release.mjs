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
  // .claude-plugin/marketplace.json carries no version since 8.3.0: the docs say
  // the manifest silently wins when both are set, so only the manifest has one
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
  // the hosted examples name the engine that made them; a lag is staleness
  try {
    const ex = JSON.parse(readFileSync(join(ROOT, 'docs/examples/examples.json'), 'utf8')).examples;
    const stale = ex.filter((e) => !(readFileSync(join(ROOT, 'docs/examples', e.file), 'utf8').includes(`ver. ${PKG().version}`)));
    say(stale.length ? `Example pages not on ${PKG().version}: ${stale.map((e) => e.file).join(', ')} (the release regenerates them)` : `All ${ex.length} example pages carry ${PKG().version}.`);
  } catch (e) { say(`Could not read the example manifest: ${e.message}`); }
  process.exit(0);
}

if (!version) die('give me the version: node release.mjs 5.1.2');
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) die(`"${version}" is not a semver version`);

// Compare against the last commit, not the working tree: a dry run leaves the
// bump written to disk, and re-running for real must not trip over its own
// earlier pass.
const current = JSON.parse(git('show', 'HEAD:package.json')).version;
const tags = git('tag', '--list', `v${version}`);
if (tags) die(`tag v${version} already exists. Versions are never reused: npm rejects a republished version.`);
// The tag is the release, not the number in package.json: a version bumped
// and committed ahead of the release (9.0.0 was, so the regenerated examples
// could carry it) is fine as long as no tag claims it yet.
if (version === current) ok(`${version} is already written and committed; no tag claims it, so this is the release of it`);
else ok(`${current} → ${version}${PKG().version === version ? ' (already written to disk, likely a dry run)' : ''}`);
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

// ---------- 2b. the hosted examples are made by the engine being released ----------
// Each example page says in its footer which version made it. Until 9.0.0
// they were regenerated only when someone remembered, so the footers lagged
// npm by up to seven releases (8.2.2 on pages served next to 8.9.2). Now the
// release rescans every example from its clone, after the version is written
// and before the tests, and refuses to ship if an example's score moved
// without the README and the landing page being told.

step('Regenerating the hosted examples');

const EXAMPLES = JSON.parse(readFileSync(join(ROOT, 'docs/examples/examples.json'), 'utf8')).examples;
const CLONES = process.env.ROAST_CLONES || join(process.env.HOME, 'Downloads/repos');
const scoreOf = (html) => (html.match(/og:title" content="[^"]*?: (\d+|No score)\/?100?/) || [])[1] ?? null;
{
  const missing = EXAMPLES.filter((e) => !existsSync(join(CLONES, e.clone)));
  if (missing.length && !argv.includes('--skip-examples')) {
    die(`clones missing under ${CLONES}: ${missing.map((e) => e.clone).join(', ')}. Clone them (see docs/examples/examples.json), set ROAST_CLONES, or pass --skip-examples to ship stale example pages on purpose.`);
  }
  const moved = [];
  for (const e of EXAMPLES) {
    const page = join(ROOT, 'docs/examples', e.file);
    const clone = join(CLONES, e.clone);
    if (!existsSync(clone)) { say(`  \x1b[33m…${e.file} skipped, no clone\x1b[0m`); continue; }
    const before = existsSync(page) ? scoreOf(readFileSync(page, 'utf8')) : null;
    // the page's canonical URL and its preview card (docs/examples/og), so a
    // shared link shows the card; regenerating without them dropped the
    // tags between 8.2.2 and 9.0.1
    const og = [...(e.url ? ['--og-url', e.url] : []), ...(e.ogImage ? ['--og-image', e.ogImage] : [])];
    const r = spawnSync(process.execPath, ['cli/roast.mjs', clone, '--no-open', '--out', page, ...og], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, CI: '1' } });
    if (r.status !== 0) die(`${e.file}: the scan of ${clone} failed\n${r.stderr.slice(-800)}`);
    const html = readFileSync(page, 'utf8');
    if (!html.includes(`ver. ${version}`)) die(`${e.file} does not carry "ver. ${version}" in its footer after regeneration`);
    if (e.ogImage && !html.includes(`og:image" content="${e.ogImage}`)) die(`${e.file} lost its link-preview card (og:image) after regeneration`);
    const after = scoreOf(html);
    if (before !== null && after !== before) moved.push(`${e.file}: ${before} → ${after}`);
    ok(`${e.file} — ${e.repo}${after ? `, ${after}${/^\d/.test(after) ? '/100' : ''}` : ''}`);
  }
  if (moved.length) {
    die(`an example's score moved on this engine:\n    ${moved.join('\n    ')}\n  Update the README example list and the landing-page cards to the new numbers (or say why in the changelog), then re-run.`);
  }
}

// ---------- 3. the changelog is not optional ----------

step('Changelog');

let changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
if (!new RegExp(`^## ${version.replace(/\./g, '\\.')}\\s`, 'm').test(changelog)) {
  die(`CHANGELOG.md has no "## ${version}" section. Write it before releasing: the changelog is what the next person reads to understand what moved.`);
}
ok(`"## ${version}" section present`);
// The heading is written as "unreleased" while the work lands; the release
// is the moment it gets its date. 8.6.2 and 8.7.0 shipped with "unreleased"
// in the heading and in the GitHub release notes before this stamped it.
const unreleased = new RegExp(`^(## ${version.replace(/\./g, '\\.')} — )unreleased`, 'm');
if (unreleased.test(changelog)) {
  changelog = changelog.replace(unreleased, `$1${new Date().toISOString().slice(0, 10)}`);
  if (!DRY && !CHECK_ONLY) writeFileSync(join(ROOT, 'CHANGELOG.md'), changelog);
  ok(`"## ${version}" dated today`);
}

// ---------- 4. the same gates CI will run ----------

step('Tests (the same ones the publish workflow runs)');

if (!run('node cli/roast.mjs . --no-open --out /tmp/self-roast.html')) die('smoke test failed: the CLI cannot roast its own repo');
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

// ---------- screenshots cannot go stale silently ----------
// The report's screenshots went stale after visual changes THREE times (5.2.3,
// 5.5.1, 5.6.1 — every one caught by Greg, none by a check), and the honesty
// question below was being answered by release automation piping "y". So this
// is mechanical: if anything under the report's code changed since the last
// release, the README screenshot cache-key must carry THIS version, which can
// only be true if someone touched the screenshots this release. Reshoot (or,
// for a genuinely invisible change, bump the ?v= deliberately) and re-run.
{
  let lastTag = '';
  try { lastTag = git('describe', '--tags', '--abbrev=0'); } catch { /* first release ever */ }
  if (lastTag) {
    const committed = git('diff', '--name-only', `${lastTag}..HEAD`);
    const uncommitted = git('status', '--porcelain');
    const reportChanged = `${committed}\n${uncommitted}`.split('\n').some((f) => f.includes('scripts/diagnose/'));
    if (reportChanged) {
      const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
      const m = readme.match(/report-full-dark\.png\?v=([0-9.]+)/);
      if (!m || m[1] !== version) {
        die(`the report's code changed since ${lastTag}, but README.md's screenshot cache-key is ?v=${m ? m[1] : 'missing'}, not ?v=${version}. Reshoot the screenshots on the current report (or bump the ?v= deliberately for an invisible change), then re-run.`);
      }
      ok(`report changed and screenshots carry ?v=${version}`);
    }
  }
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
  // A failed run is a failed release: 8.9.0's Action gave up waiting for npm
  // and this script went on to announce the version and create the GitHub
  // release as if nothing had happened. Stop here instead.
  if (!run(`gh run watch --exit-status $(gh run list --workflow=publish.yml --limit 1 --json databaseId --jq '.[0].databaseId')`)) {
    die(`the publish Action failed. Read it: gh run view --log-failed. If npm already serves ${version}, publish the listing alone with: gh workflow run publish.yml -f version=${version}`);
  }
} else {
  say('  gh CLI not installed, so no live view. Check:');
  say('  https://github.com/gregkozakiewicz/roast-my-design-system/actions\n');
}

step('Verifying what the world can see');

const npmVersion = spawnSync('npm', ['view', `roast-my-design-system@${version}`, 'version'], { encoding: 'utf8' }).stdout.trim();
npmVersion === version ? ok(`npm serves ${version}`) : say(`  \x1b[33m…npm does not serve ${version} yet. It can lag a minute; re-check with: npm view roast-my-design-system version\x1b[0m`);

// Metadata replicating before the file is a real failure mode (5.6.2 listed
// for minutes while its tarball 404'd, breaking every npx @latest run). The
// metadata check above cannot see it; fetching the tarball itself can.
{
  const tarUrl = `https://registry.npmjs.org/roast-my-design-system/-/roast-my-design-system-${version}.tgz`;
  let served = false;
  for (let i = 0; i < 6 && !served; i++) {
    const code = spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-I', tarUrl], { encoding: 'utf8' }).stdout.trim();
    if (code === '200') served = true;
    else { say(`  …tarball not served yet (HTTP ${code}), waiting`); spawnSync('sleep', ['20']); }
  }
  served ? ok(`tarball downloads (npx @latest actually works)`)
    : say(`  \x1b[31m✗ tarball still not served: ${tarUrl}\n    @latest is BROKEN for users until this heals. Re-check in minutes; if it persists, republish as the next patch.\x1b[0m`);
}

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

  // The GitHub About section (repo description) is Greg's, maintained by hand
  // (his call, 2026-09-05). The release never touches it any more; this line
  // is only a reminder that it exists as a surface.
  say('  repo description (About section) is maintained by hand — not touched');
}

say(`\n\x1b[32m${version} is out.\x1b[0m`);
say(`  npm       https://www.npmjs.com/package/roast-my-design-system`);
say(`  release   https://github.com/gregkozakiewicz/roast-my-design-system/releases/tag/v${version}`);
say(`  registry  https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.gregkozakiewicz`);
say(`\n  Still yours to do: refresh the installed skill.\n`);
