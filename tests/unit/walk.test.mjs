// The walker, exclusions and workspaces on throwaway directories.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { walkRepo, readSource, MAX_SOURCE_BYTES } from '../../skills/roast-my-design-system/scripts/harvest/walk.mjs';
import { loadExclusions, parseRoastignore } from '../../skills/roast-my-design-system/scripts/lib/exclusions.mjs';
import { resolveWorkspaces } from '../../skills/roast-my-design-system/scripts/lib/workspaces.mjs';

const scratch = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'roast-unit-'));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  return root;
};

test('walkRepo: code and styles found, noise skipped, symlinks not followed', () => {
  const root = scratch({
    'src/App.tsx': '<div/>', 'src/site.css': '.a{}', 'src/App.test.tsx': 'test', 'src/.hidden.tsx': 'x',
    'node_modules/pkg/index.js': 'x', 'dist/bundle.js': 'x', 'README.md': '#', 'package.json': '{}',
  });
  symlinkSync(join(root, 'package.json'), join(root, 'src/leak.css'));
  const files = walkRepo(root);
  assert.deepEqual(files.code, ['src/App.tsx']);
  assert.deepEqual(files.styles, ['src/site.css']);
  assert.ok(!files.other.some((f) => f.includes('node_modules') || f.includes('dist/')));
  rmSync(root, { recursive: true, force: true });
});

test('exclusions: whole-segment prefix, counted, from file and flag', () => {
  assert.deepEqual(parseRoastignore('# note\n\nlab/\n./piglet\n\\apps\\play\n'), ['lab', 'piglet', 'apps/play']);
  const root = scratch({ '.roastignore': 'lab/\n', 'lab/x.css': '.a{}', 'labs/y.css': '.b{}', 'src/z.css': '.c{}', 'piglet/p.tsx': '<a/>' });
  const ex = loadExclusions(root, ['piglet']);
  assert.deepEqual(ex.patterns.map((p) => `${p.pattern}:${p.source}`), ['lab:.roastignore', 'piglet:--exclude']);
  const files = walkRepo(root, 14, ex);
  assert.deepEqual(files.styles.sort(), ['labs/y.css', 'src/z.css'], 'lab is out, labs stays');
  assert.equal(ex.patterns[0].files, 1);
  assert.equal(ex.patterns[1].files, 1);
  rmSync(root, { recursive: true, force: true });
});

test('readSource: a file over the cap reads as null, not as evidence', () => {
  const root = scratch({ 'small.css': '.a{}' });
  writeFileSync(join(root, 'big.css'), 'x'.repeat(MAX_SOURCE_BYTES + 1));
  assert.equal(readSource(join(root, 'small.css')), '.a{}');
  assert.equal(readSource(join(root, 'big.css')), null);
  assert.equal(readSource(join(root, 'absent.css')), null);
  rmSync(root, { recursive: true, force: true });
});

test('workspaces: package.json globs, negation, pnpm yaml, and the memo notices edits', () => {
  const root = scratch({
    'package.json': JSON.stringify({ workspaces: ['packages/*', 'apps/**', '!apps/sandbox'] }),
    'packages/ui/package.json': '{"name":"@x/ui"}',
    'packages/app/package.json': '{"name":"@x/app"}',
    'packages/notapkg/README.md': '#',
    'apps/web/package.json': '{"name":"web"}',
    'apps/sandbox/package.json': '{"name":"sandbox"}',
  });
  const dirs = resolveWorkspaces(root).map((w) => w.dir);
  assert.deepEqual(dirs, ['apps/web', 'packages/app', 'packages/ui']);
  // edit the declaration: the cached answer must not survive the change
  const pkgPath = join(root, 'package.json');
  writeFileSync(pkgPath, JSON.stringify({ workspaces: ['packages/ui'] }));
  const t = new Date(Date.now() + 5000);
  utimesSync(pkgPath, t, t);
  assert.deepEqual(resolveWorkspaces(root).map((w) => w.dir), ['packages/ui']);
  rmSync(root, { recursive: true, force: true });

  const pn = scratch({
    'package.json': '{"name":"root"}',
    'pnpm-workspace.yaml': 'packages:\n  # comment\n  - "packages/*"\n  - \'!packages/skip\'\ncatalog:\n  react: 18\n',
    'packages/a/package.json': '{"name":"a"}', 'packages/skip/package.json': '{"name":"skip"}',
  });
  assert.deepEqual(resolveWorkspaces(pn).map((w) => w.name), ['a']);
  rmSync(pn, { recursive: true, force: true });
});

test('walkRepo: a generator\'s templates are scaffolding, a product\'s templates are screens', () => {
  const root = scratch({
    'src/App.tsx': '<div/>',
    // copied out into someone else's new repo: left out, and named
    'scripts/cleanup-templates/clerk/app-sidebar.tsx': '<nav/>',
    'packages/create-app/templates/default-app/App.tsx': '<div/>',
    'packages/cli/src/templates/nextjs/page.tsx': '<div/>',
    'starters/nextjs/Header.tsx': '<header/>',
    'packages/novu/src/commands/init/templates/app/page.tsx': '<main/>',
    'packages/upgrade/transforms/__testfixtures__/Button.input.tsx': '<button/>',
    // features of the product that happen to be called templates: read
    'plugins/scaffolder/src/components/templates/FieldTemplate.tsx': '<div/>',
    'src/settings/case_templates/CaseTemplateTasks.tsx': '<div/>',
    'src/templates/Dashboard.tsx': '<div/>',
  });
  const files = walkRepo(root);
  assert.deepEqual(files.code.sort(), [
    'plugins/scaffolder/src/components/templates/FieldTemplate.tsx',
    'src/App.tsx',
    'src/settings/case_templates/CaseTemplateTasks.tsx',
    'src/templates/Dashboard.tsx',
  ]);
  assert.deepEqual(files.skipped.map((s) => s.dir).sort(), [
    '__testfixtures__', 'packages/cli/src/templates', 'packages/create-app/templates',
    'packages/novu/src/commands/init/templates',
    'scripts/cleanup-templates', 'starters',
  ]);
  rmSync(root, { recursive: true, force: true });
});

// 9.7.0: one scan reads each file once; anything else always reads fresh
test('readSource reads fresh unless the scan turned its memory on', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { readSource, cachedSource } = await import('../../skills/roast-my-design-system/scripts/harvest/walk.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'roast-read-'));
  try {
    const f = join(dir, 'a.tsx');
    writeFileSync(f, 'one');
    assert.equal(readSource(f), 'one');
    writeFileSync(f, 'two');
    assert.equal(readSource(f), 'two');
    assert.equal(cachedSource(f), undefined);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('with the memory on, a file is read from disk once', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { execFileSync } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'roast-read-'));
  try {
    const f = join(dir, 'a.tsx');
    writeFileSync(f, 'one');
    const walk = new URL('../../skills/roast-my-design-system/scripts/harvest/walk.mjs', import.meta.url).href;
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', `
      import { enableReadCache, readSource, cachedSource } from '${walk}';
      import { writeFileSync } from 'node:fs';
      enableReadCache();
      const a = readSource(${JSON.stringify(f)});
      writeFileSync(${JSON.stringify(f)}, 'two');
      console.log(a, readSource(${JSON.stringify(f)}), cachedSource(${JSON.stringify(f)}));`], { encoding: 'utf8' }).trim();
    assert.equal(out, 'one one one');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
