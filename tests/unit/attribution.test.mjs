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
import { harvestComponents } from '../../skills/roast-my-design-system/scripts/harvest/components.mjs';
import { loadExclusions } from '../../skills/roast-my-design-system/scripts/lib/exclusions.mjs';

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
