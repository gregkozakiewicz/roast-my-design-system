// Pages a headless browser prints: React turned into HTML and handed to
// puppeteer for a PDF. The styling is inline because the page loads none of
// the app's stylesheets, like an email's. rybbit's PDF reports held 31 of its
// 52 inline styles (2026-09-30). The templates carry no marker of their own;
// the file that prints them does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { walkRepo } from '../../skills/roast-my-design-system/scripts/harvest/walk.mjs';
import { harvestTokens } from '../../skills/roast-my-design-system/scripts/harvest/tokens.mjs';
import { loadKnowledge } from '../../skills/roast-my-design-system/scripts/mcp/knowledge.mjs';
import { validateContent } from '../../skills/roast-my-design-system/scripts/mcp/engine.mjs';
import { exemptReason, learnSystem } from '../../skills/roast-my-design-system/scripts/lib/guard-api.mjs';

for (const v of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete process.env[v];

const CARD = "export function Card() { return <div style={{ color: '#c0ffee', padding: '13px' }}>x</div>; }\n";
const FILES = {
  'package.json': JSON.stringify({ name: 'app', dependencies: { react: '^19.0.0' } }),
  'app/src/styles.css': ':root { --ink: #101828; }\n',
  // a shared component the printed page borrows: it lives outside the
  // printer's folder, so it is still the app's own interface
  'app/src/ui/Button.tsx': "export function Button() { return <button style={{ color: '#c0ffee' }}>b</button>; }\n",
  'server/package.json': JSON.stringify({ name: 'server', dependencies: { puppeteer: '^23.0.0' } }),
  'server/src/pdf/service.ts': [
    "import puppeteer from 'puppeteer';",
    "import { renderToStaticMarkup } from 'react-dom/server';",
    "import { Report } from './templates/Report.js';",
    'export async function pdf() { const html = renderToStaticMarkup(Report()); const b = await puppeteer.launch(); return b; }',
  ].join('\n'),
  'server/src/pdf/templates/Report.tsx': "import { Card } from './components/index.js';\nimport { Button } from '../../../../app/src/ui/Button';\nexport function Report() { return <main style={{ padding: '24px' }}><Card /><Button /></main>; }\n",
  'server/src/pdf/templates/components/index.ts': "export { Card } from './Card.js';\n",
  'server/src/pdf/templates/components/Card.tsx': CARD,
  // a test setup: playwright as a dev dependency renders a component to
  // check it; nothing here is printed for anyone
  'tools/visual/package.json': JSON.stringify({ name: 'visual', devDependencies: { playwright: '^1.0.0' } }),
  'tools/visual/snap.ts': "import { chromium } from 'playwright';\nimport { renderToString } from 'react-dom/server';\nimport { Shot } from './Shot';\nexport const go = async () => { renderToString(Shot()); await chromium.launch(); };\n",
  'tools/visual/Shot.tsx': CARD.replace('Card', 'Shot'),
};

function scratch() {
  const root = mkdtempSync(join(tmpdir(), 'roast-printed-'));
  for (const [f, body] of Object.entries(FILES)) {
    mkdirSync(join(root, dirname(f)), { recursive: true });
    writeFileSync(join(root, f), body);
  }
  return root;
}

test('the walk finds the pages the printer prints, and only inside its own folder', () => {
  const root = scratch();
  const files = walkRepo(root);
  assert.deepEqual(files.email.printed, ['server/src/pdf/templates/Report.tsx', 'server/src/pdf/templates/components/Card.tsx']);
  rmSync(root, { recursive: true, force: true });
});

test('a printed page is not judged, and says why; the shared Button still is', () => {
  const root = scratch();
  const files = walkRepo(root);
  assert.match(exemptReason('server/src/pdf/templates/components/Card.tsx', CARD, { email: files.email }), /headless browser/);
  assert.equal(exemptReason('app/src/ui/Button.tsx', FILES['app/src/ui/Button.tsx'], { email: files.email }), null);
  assert.equal(exemptReason('tools/visual/Shot.tsx', FILES['tools/visual/Shot.tsx'], { email: files.email }), null);
  rmSync(root, { recursive: true, force: true });
});

test('the report, the live check and the guard doorway give the same answer', () => {
  const root = scratch();
  const files = walkRepo(root);
  const t = harvestTokens(root, files.styles, files.code, { email: files.email });
  const exempt = t.exemptFiles.map((e) => e.file).sort();
  assert.ok(exempt.includes('server/src/pdf/templates/components/Card.tsx'), JSON.stringify(exempt));
  assert.ok(!exempt.includes('app/src/ui/Button.tsx'));
  const k = loadKnowledge(root);
  const card = validateContent({ text: CARD, file: 'server/src/pdf/templates/components/Card.tsx' }, k);
  assert.match(card.exempt ?? '', /headless browser/);
  const button = validateContent({ text: FILES['app/src/ui/Button.tsx'], file: 'app/src/ui/Button.tsx' }, k);
  assert.ok(!button.exempt);
  assert.ok(button.findings.length > 0);
  assert.deepEqual(learnSystem(root).email.printed, files.email.printed);
  rmSync(root, { recursive: true, force: true });
});
