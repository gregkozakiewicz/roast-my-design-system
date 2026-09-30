// The exemption rule (lib/exempt.mjs), one answer for the report, the live
// checks and the guard. First the newest case, then the parity itself.
//
// Pages a headless browser prints: React turned into HTML and handed to
// puppeteer for a PDF. The styling is inline because the page loads none of
// the app's stylesheets, like an email's. rybbit's PDF reports held 31 of its
// 52 inline styles (2026-09-30). The templates carry no marker of their own;
// the file that prints them does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { walkRepo } from '../../skills/roast-my-design-system/scripts/harvest/walk.mjs';
import { harvestTokens } from '../../skills/roast-my-design-system/scripts/harvest/tokens.mjs';
import { loadKnowledge } from '../../skills/roast-my-design-system/scripts/mcp/knowledge.mjs';
import { validateContent } from '../../skills/roast-my-design-system/scripts/mcp/engine.mjs';
import { exemptReason, learnSystem } from '../../skills/roast-my-design-system/scripts/lib/guard-api.mjs';
import { splitArbitrary } from '../../skills/roast-my-design-system/scripts/profiles/index.mjs';

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

// ---------- one exemption rule for the report and the live checks ----------
// Until 9.3.3 the report's counter kept its own list: a file named Badge or
// IconButton walked free there on its name alone while the live checks judged
// it, and an icon in an icons folder was counted there while exempt
// everywhere else.

test('the report counts what the live checks judge, and skips what they exempt', () => {
  const root = mkdtempSync(join(tmpdir(), 'roast-onerule-'));
  const put = (f, body) => { mkdirSync(join(root, dirname(f)), { recursive: true }); writeFileSync(join(root, f), body); };
  put('package.json', JSON.stringify({ name: 'app', dependencies: { react: '^19.0.0' } }));
  put('src/styles.css', ':root { --ink: #101828; }\n');
  // named like artwork, draws nothing: interface
  put('src/components/StatusBadge.tsx', "export const StatusBadge = () => <span style={{ color: '#c0ffee', padding: '13px' }}>ok</span>;\n");
  // an icon in an icons folder, named for what it shows: artwork
  put('src/icons/Server.tsx', "export const Server = () => <svg style={{ color: '#abcdef' }} viewBox=\"0 0 16 16\"><path fill=\"#abcdef\" d=\"M1 1h14\" /></svg>;\n");
  const files = walkRepo(root);
  const t = harvestTokens(root, files.styles, files.code, { email: files.email });
  const skipped = t.exemptFiles.map((e) => e.file);
  for (const [f, code] of [['src/components/StatusBadge.tsx', false], ['src/icons/Server.tsx', true]]) {
    const text = readFileSync(join(root, f), 'utf8');
    assert.equal(skipped.includes(f), code, `${f}: report skipped ${skipped.includes(f)}`);
    assert.equal(!!exemptReason(f, text, { email: files.email }), code, `${f}: live checks exempt`);
  }
  rmSync(root, { recursive: true, force: true });
});

test('a bracket value in more files than the list shows is split exactly', () => {
  // [3px] 10 times: five files listed (9 uses), the sixth, installed, is not
  const files = ['a', 'b', 'c', 'd'].map((n) => ({ file: `components/ui/${n}.tsx`, count: 2 })).concat([{ file: 'components/ui/badge.tsx', count: 1 }]);
  const entry = { value: '[3px]', count: 10, files, every: [...files, { file: 'components/ui/label.tsx', count: 1 }] };
  const { own, installed } = splitArbitrary([entry], ['components/ui']);
  assert.equal(installed.uses, 10);
  assert.deepEqual(own, []);
  // without the whole tally the unlisted use is taken for the team's own
  const capped = splitArbitrary([{ value: '[3px]', count: 10, files }], ['components/ui']);
  assert.equal(capped.own[0].count, 1);
});
