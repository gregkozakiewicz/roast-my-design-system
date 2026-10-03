// Five misreads found dogfooding 8.4.6 on the Ledgerly demo (a Vite + React +
// Tailwind v4 app, 2026-09-24), each rebuilt here in miniature: the same
// theme, the same src/ui folder, the same duplicate Button.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { loadKnowledge } from '../../skills/roast-my-design-system/scripts/mcp/knowledge.mjs';
import { getContext, findComponent } from '../../skills/roast-my-design-system/scripts/mcp/tools.mjs';
import { validateContent } from '../../skills/roast-my-design-system/scripts/mcp/engine.mjs';

const THEME = `@import "tailwindcss";
@theme {
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-weight-bold: 700;
  --color-canvas: #f5f6f8;
  --color-surface: #ffffff;
  --color-border: #e4e7ec;
  --color-ink: #101828;
  --color-ink-muted: #475467;
  --color-brand: #3b5bdb;
  --color-positive: #12805c;
  --color-positive-soft: #e7f5ef;
  --color-negative: #c23b22;
  --color-negative-soft: #fcefeb;
  --color-warning: #b25e09;
  --color-warning-soft: #fdf5e6;
  --color-warning-border: #f5d9a8;
}
`;
const comp = (name, body = '<div className="bg-surface text-ink border-border" />') =>
  `export function ${name}(props) { return ${body}; }\n`;
const uses = (tag, n) => Array.from({ length: n }, () => `<${tag} />`).join('');

const FILES = {
  'package.json': JSON.stringify({ name: 'ledgerly', private: true, dependencies: { react: '^19.0.0', tailwindcss: '^4.1.0' } }),
  'src/styles/tokens.css': THEME,
  // one legacy stack, the only font-family line in the repo
  'src/features/settings/settings.css': '.legacy { font-family: "Helvetica Neue", Arial, sans-serif; }\n',
  'src/ui/Button.tsx': comp('Button'),
  'src/ui/Alert.tsx': comp('Alert'),
  'src/ui/Select.tsx': comp('Select'),
  'src/ui/Card.tsx': comp('Card'),
  'src/ui/index.ts': "export { Button } from './Button';\nexport { Alert } from './Alert';\nexport { Select } from './Select';\nexport { Card } from './Card';\n",
  'src/features/invoices/ButtonV2.tsx': comp('Button', '<button className="bg-brand text-surface" />'),
  // eight uses of the shared Button through the barrel, four of the copy
  'src/layout/TopBar.tsx': `import { Button, Card } from '../ui';\nexport function TopBar() { return <Card>${uses('Button', 3)}</Card>; }\n`,
  'src/features/overview/Overview.tsx': `import { Button, Alert, Select } from '../../ui';\nexport function Overview() { return <div className="bg-canvas text-ink-muted">${uses('Button', 5)}<Alert /><Select /></div>; }\n`,
  'src/features/invoices/InvoiceDetail.tsx': `import { Button } from './ButtonV2';\nexport function InvoiceDetail() { return <div className="bg-surface text-ink">${uses('Button', 2)}</div>; }\n`,
  'src/features/settings/Billing.tsx': `import { Button } from '../invoices/ButtonV2';\nexport function Billing() { return <div className="bg-surface border-border text-positive bg-positive-soft">${uses('Button', 2)}</div>; }\n`,
};

const root = mkdtempSync(join(tmpdir(), 'roast-ledgerly-'));
for (const [f, body] of Object.entries(FILES)) {
  mkdirSync(join(root, dirname(f)), { recursive: true });
  writeFileSync(join(root, f), body);
}
after(() => rmSync(root, { recursive: true, force: true }));
const k = loadKnowledge(root);

const fixFor = (cls) => {
  const { findings } = validateContent({ text: `export const X = () => <div className="${cls}" />;\n`, file: 'src/features/x/X.tsx' }, k);
  return findings.find((f) => f.rule === 'palette-class')?.fix ?? '';
};

test('a palette class is pointed at the theme colour nearest by value, hue included', () => {
  assert.match(fixFor('bg-amber-50'), /\(bg-warning-soft\)/);
  assert.match(fixFor('text-amber-800'), /\(text-warning\)/);
  assert.match(fixFor('border-amber-200'), /\(border-warning-border\)/);
  assert.match(fixFor('bg-red-50'), /\(bg-negative-soft\)/);
  assert.match(fixFor('text-green-700'), /\(text-positive\)/);
  assert.match(fixFor('text-gray-500'), /\(text-ink-muted\)/);
  assert.match(fixFor('bg-blue-600'), /\(bg-brand\)/);
});

test('the name suits the utility: a text class is never sent to a surface', () => {
  // warning-soft is nearer to amber-100 by value, but it is a surface
  assert.doesNotMatch(fixFor('text-amber-100'), /warning-soft|warning-border/);
});

test('with nothing close, the old pick by name answers', () => {
  // no purple anywhere in the theme
  assert.match(fixFor('bg-purple-600'), /\(bg-canvas\)/);
});

test('the example new token follows the hue, in the theme\'s own words', () => {
  assert.match(fixFor('bg-amber-50'), /add a warning shade to the theme once/);
  assert.match(fixFor('bg-red-50'), /add a negative shade/);
  assert.match(fixFor('bg-purple-600'), /for example accent, and use bg-accent/);
  assert.doesNotMatch(fixFor('bg-amber-50'), /success/);
});

test('@theme --font-* rows are declared typefaces, listed first', () => {
  const type = getContext(k).split('\n').find((l) => l.startsWith('TYPE:'));
  assert.match(type, /^TYPE: Inter Variable, Helvetica Neue\./);
  // a weight is not a typeface
  assert.doesNotMatch(type, /700/);
});

test('uses of a duplicated component go to the copy each file imports', () => {
  const buttons = k.byName.get('Button');
  assert.equal(buttons.find((c) => c.file === 'src/ui/Button.tsx').usageCount, 8);
  assert.equal(buttons.find((c) => c.file === 'src/features/invoices/ButtonV2.tsx').usageCount, 4);
  const answer = findComponent(k, { query: 'Button' });
  assert.match(answer, /^Canonical: <Button> from src\/ui\/Button\.tsx \(used 8x/);
  assert.match(answer, /Avoid: src\/features\/invoices\/ButtonV2\.tsx/);
});

test('src/ui is the UI folder, and the repo does not become a shadcn one', () => {
  assert.equal(k.profile.uiDir, 'src/ui');
  assert.equal(k.profile.vendoredUi, false);
  assert.equal(k.shadcn, null);
});

test('find_component answers by purpose when nothing carries the word', () => {
  assert.match(findComponent(k, { query: 'banner' }), /Searched for "alert"[\s\S]*<Alert> from src\/ui\/Alert\.tsx/);
  assert.match(findComponent(k, { query: 'dropdown' }), /Searched for "select"[\s\S]*<Select> from src\/ui\/Select\.tsx/);
  // every word must still match: a date picker is not any Select
  assert.match(findComponent(k, { query: 'date picker' }), /^No component matching "date picker"/);
});
