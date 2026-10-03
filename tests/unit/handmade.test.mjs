// A button from scratch where the repo already has one. The value checks
// let a hand-made button through when its colours are tokens; hooked agents
// on Twenty did exactly that four times in five (2026-09-29). Buttons only,
// and only when the file's own package can import the repo's Button.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { loadKnowledge } from '../../plugin/skills/roast-my-design-system/scripts/mcp/knowledge.mjs';
import { validateContent, checksFor, BUTTON_CHECK } from '../../plugin/skills/roast-my-design-system/scripts/mcp/engine.mjs';
import { handmadeButtons, buttonFor } from '../../plugin/skills/roast-my-design-system/scripts/lib/handmade.mjs';
import { learnSystem } from '../../plugin/skills/roast-my-design-system/scripts/lib/guard-api.mjs';

for (const v of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete process.env[v];

test('a styled button dressed as a button is caught, a reset row is not', () => {
  const dressed = 'const StyledAction = styled.button`\n  background: ${({ theme }) => theme.color.blue};\n  padding: 4px 12px;\n  border-radius: 4px;\n  font-weight: 500;\n`;\n';
  assert.deepEqual(handmadeButtons(dressed).map((h) => h.name), ['StyledAction']);
  const outline = 'const SecondaryButton = styled.button`\n  background: none;\n  border: 1px solid ${line};\n  padding: 0 ${spacing(4)};\n  text-transform: uppercase;\n`;\n';
  assert.deepEqual(handmadeButtons(outline).map((h) => h.name), ['SecondaryButton']);
  const row = 'const StyledRow = styled.button`\n  background: none;\n  border: none;\n  padding: 0;\n  display: flex;\n`;\n';
  assert.deepEqual(handmadeButtons(row), []);
  const paddedRow = 'const QueryButton = styled.button`\n  background: none;\n  border: none;\n  padding: 8px 16px;\n  border-radius: 0;\n`;\n';
  assert.deepEqual(handmadeButtons(paddedRow), []);
  const namedOnly = 'const StyledButton = styled.button`\n  display: flex;\n`;\n';
  assert.deepEqual(handmadeButtons(namedOnly), [], 'a name alone is not paint');
  const closeCross = 'const CloseButton = styled.button`\n  background: var(--bg);\n  padding: 4px;\n  font-weight: 600;\n`;\n';
  const listRow = 'const StyledButton = styled.button`\n  background: var(--bg);\n  padding: 0 8px;\n  font-size: 13px;\n  flex: 1 0 0;\n`;\n';
  assert.deepEqual(handmadeButtons(listRow), [], 'a row that stretches is not a button');
  const noLabel = 'const StyledUploader = styled.button`\n  background: var(--bg);\n  padding: 8px;\n  border-radius: 4px;\n`;\n';
  assert.deepEqual(handmadeButtons(noLabel), [], 'no label styling, no button');
  assert.deepEqual(handmadeButtons(closeCross), [], 'a close cross is another role');
  const hoverOnly = 'const StyledTier = styled.button`\n  background: transparent;\n  border: none;\n  padding: 4px;\n  &:hover {\n    background: ${bg};\n  }\n`;\n';
  assert.deepEqual(handmadeButtons(hoverOnly), [], 'hover paint is a state, not the resting paint');
  const variantBlock = 'const Button = styled.button`\n  background: transparent;\n  border: none;\n  padding: 8px 16px;\n  font-weight: 600;\n  &.primary {\n    background-color: var(--button-bg);\n  }\n`;\n';
  assert.equal(handmadeButtons(variantBlock).length, 1, 'a class variant carrying the paint is the button');
  const emotionObject = "const StyledSave = styled('button')({ backgroundColor: '#fff', padding: 8, borderRadius: 4, fontWeight: 500 });\n";
  assert.equal(handmadeButtons(emotionObject).length, 1);
  const wrapsTheReal = 'const StyledButton = styled(Button)`\n  margin: 0;\n`;\n';
  assert.deepEqual(handmadeButtons(wrapsTheReal), []);
});

test('a button tag dressed with classes or inline paint is caught, a class from a stylesheet is not', () => {
  assert.equal(handmadeButtons('<button className="bg-blue-600 px-4 py-2 rounded text-white">Save</button>').length, 1);
  assert.equal(handmadeButtons('<button className="w-full rounded-lg border border-stroke-soft px-3 py-2 font-medium">Continue</button>').length, 1, 'a full-width labelled button');
  assert.equal(handmadeButtons('<button className="flex h-8 w-full items-center justify-between rounded-md border px-2 py-1 font-medium">Pick</button>').length, 0, 'a select trigger');
  assert.equal(handmadeButtons('<button className="rounded-lg border p-3 text-left font-medium">Option</button>').length, 0, 'an option card');
  assert.equal(handmadeButtons('<button className="h-10 w-10 rounded-md bg-slate-500 p-2 text-white">^</button>').length, 0, 'an icon square');
  assert.equal(handmadeButtons('<button className="rounded-md border bg-white px-4 py-2">plain</button>').length, 0, 'no label styling');
  assert.equal(handmadeButtons('<button className="border border-line px-4 py-2 font-medium">Cancel</button>').length, 1, 'an outline button');
  assert.equal(handmadeButtons('<button className={styles.showMore} onClick={x}>more</button>').length, 0);
  assert.equal(handmadeButtons('<button className="mt-1 text-blue-600" type="button">like</button>').length, 0);
  assert.equal(handmadeButtons('<button className="bg-transparent p-2">x</button>').length, 0);
  assert.equal(handmadeButtons('<button className="flex h-8 px-2 hover:bg-muted">row</button>').length, 0, 'a hover state is not resting paint');
  assert.equal(handmadeButtons('<button className="rounded-sm bg-state-warning px-1.5 py-0.5 text-2xs font-bold">TK</button>').length, 0, 'a badge');
  assert.equal(handmadeButtons('<button className="rounded-full border bg-background p-0.5">avatar</button>').length, 0, 'an avatar ring');
  assert.equal(handmadeButtons("<button style={{ background: '#3b5bdb', padding: '4px 12px', fontWeight: 600 }}>go</button>").length, 1);
  assert.equal(handmadeButtons("<button style={{ background: '#3b5bdb', padding: 0 }}>go</button>").length, 0);
});

test('the Button pick respects package boundaries', () => {
  const workspaces = [{ name: '@acme/ui', dir: 'packages/ui' }, { name: '@acme/app', dir: 'packages/app' }, { name: '@acme/site', dir: 'packages/site' }];
  const buttons = [
    { file: 'packages/site/src/ui/Button.tsx', usageCount: 313, spec: '@/ui/Button' },
    { file: 'packages/ui/src/input/Button.tsx', usageCount: 120, spec: '@acme/ui' },
  ];
  const packageDeps = new Map([['packages/app', new Set(['@acme/ui', 'react'])], ['packages/site', new Set(['react'])], ['packages/ui', new Set()]]);
  const k = { buttons, workspaces, packageDeps };
  assert.equal(buttonFor('packages/app/src/pages/Settings.tsx', k)?.spec, '@acme/ui', 'the app is pointed at the package it depends on, not the most-used Button');
  assert.equal(buttonFor('packages/site/src/pages/Home.tsx', k)?.usageCount, 313);
  assert.equal(buttonFor('packages/other/src/X.tsx', { ...k, workspaces: [...workspaces, { name: '@acme/other', dir: 'packages/other' }] }), null, 'a package that depends on neither gets no answer');
  assert.equal(buttonFor('scripts/tool.tsx', k)?.usageCount, 313, 'code outside every package sees them all');
  assert.equal(buttonFor('src/X.tsx', { buttons: [], workspaces: [], packageDeps: new Map() }), null);
});

// end to end: a repo with a well-used Button, and one without
const comp = (name, body) => `export function ${name}(props) { return ${body}; }\n`;
const uses = (n) => Array.from({ length: n }, (_, i) => `import { Button } from '../ui';\nexport function Page${i}() { return <div><Button /></div>; }\n`);
function repo(withButton) {
  const root = mkdtempSync(join(tmpdir(), 'roast-handmade-'));
  const files = {
    'package.json': JSON.stringify({ name: 'ledgerly', private: true, dependencies: { react: '^19.0.0' } }),
    'src/styles/tokens.css': ':root {\n  --color-brand: #3b5bdb;\n  --color-ink: #101828;\n  --color-surface: #ffffff;\n}\n',
    'src/ui/Card.tsx': comp('Card', '<div className="card" {...props} />'),
    'src/ui/index.ts': "export { Card } from './Card';\n" + (withButton ? "export { Button } from './Button';\n" : ''),
  };
  if (withButton) files['src/ui/Button.tsx'] = comp('Button', '<button className="btn" {...props} />');
  uses(withButton ? 24 : 0).forEach((body, i) => { files[`src/pages/Page${i}.tsx`] = body; });
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(join(root, dirname(f)), { recursive: true });
    writeFileSync(join(root, f), body);
  }
  return root;
}
const PAGE = "import styled from '@emotion/styled';\nconst StyledButton = styled.button`\n  background: var(--color-brand);\n  color: var(--color-surface);\n  padding: 4px 12px;\n  font-weight: 500;\n`;\nexport const Settings = () => <StyledButton>Save</StyledButton>;\n";

test('with a Button in use, a page building its own is warned and told where to import from', () => {
  const root = repo(true);
  const k = loadKnowledge(root);
  assert.equal(k.buttons.length, 1, JSON.stringify(k.buttons));
  assert.equal(k.buttons[0].spec, '../ui');
  assert.ok(checksFor(k).includes(BUTTON_CHECK));
  const { findings } = validateContent({ text: PAGE, file: 'src/pages/Settings.tsx', before: null }, k);
  const got = findings.filter((f) => f.rule === 'handmade-button');
  assert.equal(got.length, 1, JSON.stringify(findings));
  assert.equal(got[0].severity, 'warning');
  assert.equal(got[0].line, 2);
  assert.match(got[0].message, /A styled button \(StyledButton\) where the repo already has <Button> \(imported 24x from \.\.\/ui\)/);
  assert.match(got[0].fix, /import \{ Button \} from '\.\.\/ui'/);
  assert.match(got[0].fix, /add a variant there/);
  // the token colours it used are not also flagged: the choice is the finding
  assert.equal(findings.filter((f) => f.rule === 'hardcoded-colour').length, 0);
  // the guard doorway sees the same Button
  assert.equal(learnSystem(root).buttons[0]?.spec, '../ui');
  // the system's own layer is never told to use itself
  assert.equal(validateContent({ text: PAGE, file: 'src/ui/IconButton.tsx', before: null }, k).findings.filter((f) => f.rule === 'handmade-button').length, 0);
  rmSync(root, { recursive: true, force: true });
});

test('with no Button in use, the same page is left alone and the check is not listed', () => {
  const root = repo(false);
  const k = loadKnowledge(root);
  assert.equal(k.buttons.length, 0);
  assert.ok(!checksFor(k).includes(BUTTON_CHECK));
  const { findings } = validateContent({ text: PAGE, file: 'src/pages/Settings.tsx', before: null }, k);
  assert.equal(findings.filter((f) => f.rule === 'handmade-button').length, 0);
  rmSync(root, { recursive: true, force: true });
});
