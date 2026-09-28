// Which copy of a same-named component a use belongs to. A file importing
// by a workspace package name (twenty-ui/input, @calcom/ui) credits the copy
// inside that package only. Until 9.2.0 every copy was credited, so Twenty's
// marketing-site Button carried the app's 274 uses, and cal.com's new
// design-system package showed an Alert as adopted 65 times when nobody
// imported it (2026-09-29).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { walkRepo } from '../../skills/roast-my-design-system/scripts/harvest/walk.mjs';
import { harvestComponents, tsconfigAliases } from '../../skills/roast-my-design-system/scripts/harvest/components.mjs';
import { loadExclusions } from '../../skills/roast-my-design-system/scripts/lib/exclusions.mjs';
import { resolveWorkspaces } from '../../skills/roast-my-design-system/scripts/lib/workspaces.mjs';

for (const v of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete process.env[v];

const comp = (name) => `export function ${name}(props) { return <button {...props} />; }\n`;
const page = (i, spec) => `import { Button } from '${spec}';\nexport function Page${i}() { return <div><Button /><Button /></div>; }\n`;
const FILES = {
  'package.json': JSON.stringify({ name: 'acme', private: true, workspaces: ['packages/*'] }),
  'packages/ui/package.json': JSON.stringify({ name: '@acme/ui', dependencies: { react: '^19.0.0' } }),
  'packages/ui/src/Button.tsx': comp('Button'),
  'packages/ui/src/index.ts': "export { Button } from './Button';\n",
  'packages/site/package.json': JSON.stringify({ name: '@acme/site', dependencies: { react: '^19.0.0' } }),
  'packages/site/src/ui/Button.tsx': comp('Button'),
  'packages/app/package.json': JSON.stringify({ name: '@acme/app', dependencies: { '@acme/ui': 'workspace:*', react: '^19.0.0' } }),
};
for (let i = 0; i < 4; i++) FILES[`packages/app/src/Page${i}.tsx`] = page(i, '@acme/ui');
for (let i = 0; i < 2; i++) FILES[`packages/site/src/Page${i}.tsx`] = page(i, './ui/Button');
FILES['packages/app/src/Mystery.tsx'] = page(9, 'some-npm-package');

test('a workspace package import credits the copy inside that package only', () => {
  const root = mkdtempSync(join(tmpdir(), 'roast-attribution-'));
  for (const [f, body] of Object.entries(FILES)) {
    mkdirSync(join(root, dirname(f)), { recursive: true });
    writeFileSync(join(root, f), body);
  }
  const files = walkRepo(root, 14, loadExclusions(root, []));
  const { components } = harvestComponents(root, files.code);
  const uses = (file) => components.find((c) => c.name === 'Button' && c.file === file)?.usageCount;
  // 4 app pages x 2 uses through @acme/ui, plus the unresolvable npm import (2, credited to every copy)
  assert.equal(uses('packages/ui/src/Button.tsx'), 10);
  // 2 site pages x 2 uses by relative path, plus the same unresolvable 2
  assert.equal(uses('packages/site/src/ui/Button.tsx'), 6);
  rmSync(root, { recursive: true, force: true });
});

test('a tsconfig path alias credits the copy under the folder it names', () => {
  const root = mkdtempSync(join(tmpdir(), 'roast-attribution-alias-'));
  const F = {
    'package.json': JSON.stringify({ name: 'sentry', private: true, dependencies: { react: '^19.0.0' } }),
    // comments and a trailing comma, the way tsconfig files are written
    'tsconfig.json': '{\n  // the app\n  "compilerOptions": {\n    "paths": {\n      "@sentry/scraps/*": ["./static/app/components/core/*"],\n      "sentry/*": ["./static/app/*"],\n      "*": ["./public/*"],\n    },\n  },\n}\n',
    'static/app/components/core/button/button.tsx': comp('Button'),
    'static/app/views/settings/Button.tsx': comp('Button'),
  };
  for (let i = 0; i < 3; i++) F[`static/app/views/Page${i}.tsx`] = page(i, '@sentry/scraps/button');
  F['static/app/views/Old.tsx'] = page(7, 'sentry/views/settings/Button');
  for (const [f, body] of Object.entries(F)) {
    mkdirSync(join(root, dirname(f)), { recursive: true });
    writeFileSync(join(root, f), body);
  }
  assert.deepEqual(tsconfigAliases(root), [{ prefix: '@sentry/scraps', dir: 'static/app/components/core' }, { prefix: 'sentry', dir: 'static/app' }]);
  const files = walkRepo(root, 14, loadExclusions(root, []));
  const { components } = harvestComponents(root, files.code);
  const uses = (file) => components.find((c) => c.name === 'Button' && c.file === file)?.usageCount;
  assert.equal(uses('static/app/components/core/button/button.tsx'), 6);
  assert.equal(uses('static/app/views/settings/Button.tsx'), 2);
  rmSync(root, { recursive: true, force: true });
});

test('workspaces declared one level down (a Go root with webapp/) are found and credited', () => {
  const root = mkdtempSync(join(tmpdir(), 'roast-attribution-sub-'));
  const F = {
    'go.mod': 'module example.com/app\n',
    'webapp/package.json': JSON.stringify({ name: 'webapp', private: true, workspaces: ['channels', 'platform/shared'] }),
    'webapp/platform/shared/package.json': JSON.stringify({ name: '@acme/shared', dependencies: { react: '^19.0.0' } }),
    'webapp/platform/shared/src/components/button/button.tsx': comp('Button'),
    'webapp/channels/package.json': JSON.stringify({ name: 'channels', dependencies: { '@acme/shared': '*', react: '^19.0.0' } }),
    'webapp/channels/src/components/threading/button.tsx': comp('Button'),
  };
  for (let i = 0; i < 3; i++) F[`webapp/channels/src/Page${i}.tsx`] = page(i, '@acme/shared/components/button');
  F['webapp/channels/src/Thread.tsx'] = page(8, './components/threading/button');
  for (const [f, body] of Object.entries(F)) {
    mkdirSync(join(root, dirname(f)), { recursive: true });
    writeFileSync(join(root, f), body);
  }
  assert.deepEqual(resolveWorkspaces(root).map((w) => w.dir), ['webapp/channels', 'webapp/platform/shared']);
  const files = walkRepo(root, 14, loadExclusions(root, []));
  const { components } = harvestComponents(root, files.code);
  const uses = (file) => components.find((c) => c.name === 'Button' && c.file === file)?.usageCount;
  assert.equal(uses('webapp/platform/shared/src/components/button/button.tsx'), 6);
  assert.equal(uses('webapp/channels/src/components/threading/button.tsx'), 2);
  rmSync(root, { recursive: true, force: true });
});
