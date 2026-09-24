// Two gaps found rehearsing the Ledgerly demo on 8.5.0 (2026-09-24), rebuilt
// in miniature. (1) Asked to "match the spec exactly", an agent added six
// overdue tokens that twin existing ones; the live checks said nothing and the
// report's near-pair count went DOWN, because the old strays now equalled a
// token. (2) With roast on, the agent imported the Button copy that
// roast_find_component says to avoid, and no check mentioned it.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { loadKnowledge } from '../../skills/roast-my-design-system/scripts/mcp/knowledge.mjs';
import { getContext, validate, reviewData } from '../../skills/roast-my-design-system/scripts/mcp/tools.mjs';
import { validateContent } from '../../skills/roast-my-design-system/scripts/mcp/engine.mjs';
import { harvestTokens } from '../../skills/roast-my-design-system/scripts/harvest/tokens.mjs';
import { walkRepo } from '../../skills/roast-my-design-system/scripts/harvest/walk.mjs';
import { nearColorPairs } from '../../skills/roast-my-design-system/scripts/lib/nearpairs.mjs';
import { tokenTwinFindings, tokenDefsOf } from '../../skills/roast-my-design-system/scripts/lib/tokentwins.mjs';
import { importsOf, resolveSpec, canonicalCopy } from '../../skills/roast-my-design-system/scripts/lib/avoidedimports.mjs';

for (const v of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete process.env[v];

const LIGHT = `  --color-canvas: #f5f6f8;
  --color-surface: #ffffff;
  --color-surface-muted: #f9fafb;
  --color-ink: #101828;
  --color-brand: #3b5bdb;
  --color-brand-strong: #2f49b8;
  --color-negative-soft: #fcefeb;
  --color-warning: #b25e09;
  --color-warning-soft: #fdf5e6;
  --color-warning-border: #f5d9a8;
`;
const DARK = `  --color-brand: #6d8bff;
  --color-brand-strong: #8aa2ff;
  --color-warning: #f5b454;
  --color-warning-soft: #2b2112;
  --color-warning-border: #4a3718;
`;
const OVERDUE_LIGHT = `  --color-overdue-soft: #fff4e5;
  --color-overdue-border: #ffd8a8;
  --color-overdue-title: #8a4b08;
  --color-overdue-text: #b26b00;
  --color-overdue-action: #3d5ce0;
  --color-overdue-action-hover: #2e48b5;
`;
const OVERDUE_DARK = `  --color-overdue-soft: #2b1d0c;
  --color-overdue-border: #4a3718;
  --color-overdue-title: #ffd8a8;
  --color-overdue-text: #f5b454;
  --color-overdue-action: #6d8bff;
  --color-overdue-action-hover: #8aa2ff;
`;
const sheet = (light, dark) => `@import "tailwindcss";\n@theme {\n${light}}\n\n.dark {\n${dark}}\n`;
const THEME = sheet(LIGHT, DARK);
const THEME_AFTER = sheet(LIGHT + OVERDUE_LIGHT, DARK + OVERDUE_DARK);

const comp = (name, body) => `export function ${name}(props) { return ${body}; }\n`;
const uses = (tag, n) => Array.from({ length: n }, () => `<${tag} />`).join('');
const FILES = {
  'package.json': JSON.stringify({ name: 'ledgerly', private: true, dependencies: { react: '^19.0.0', tailwindcss: '^4.1.0' } }),
  'src/styles/tokens.css': THEME,
  'src/ui/Button.tsx': comp('Button', '<button className="bg-brand text-surface hover:bg-brand-strong" />'),
  'src/ui/index.ts': "export { Button } from './Button';\n",
  'src/features/invoices/ButtonV2.tsx': comp('Button', '<button className="bg-[#3d5ce0] text-white hover:bg-[#2e48b5]" />'),
  'src/layout/TopBar.tsx': `import { Button } from '../ui';\nexport function TopBar() { return <div className="bg-surface">${uses('Button', 8)}</div>; }\n`,
  'src/features/invoices/InvoiceDetail.tsx': `import { Button } from './ButtonV2';\nexport function InvoiceDetail() { return <div className="bg-canvas text-ink">${uses('Button', 4)}</div>; }\n`,
  'src/features/invoices/InvoicesPage.tsx': `import { Button } from '../../ui';\nexport function InvoicesPage() { return <div className="bg-surface-muted"><Button /></div>; }\n`,
};

const root = mkdtempSync(join(tmpdir(), 'roast-twins-'));
for (const [f, body] of Object.entries(FILES)) {
  mkdirSync(join(root, dirname(f)), { recursive: true });
  writeFileSync(join(root, f), body);
}
const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'ignore' });
git('init', '-q');
git('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.');
git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base');
after(() => rmSync(root, { recursive: true, force: true }));

const pairsIn = () => {
  const f = walkRepo(root, 14, { patterns: [] });
  return nearColorPairs(harvestTokens(root, f.styles, f.code).colors);
};

// ---------- gap 1: twin tokens ----------

test('the report does not pair designed neighbours in a theme', () => {
  // canvas beside surface-muted, pale red beside pale amber: 4 and 6 channel
  // steps, but each tells apart by eye, so neither is a twin
  const twins = pairsIn().filter((p) => p.tokens);
  assert.deepEqual(twins, []);
});

test('a stray fixed by minting a twin token does not shrink the near-pair count', () => {
  const before = pairsIn().length;
  writeFileSync(join(root, 'src/styles/tokens.css'), THEME_AFTER);
  try {
    const now = pairsIn();
    assert.ok(now.length > before, `pairs went ${before} -> ${now.length}`);
    const twins = now.filter((p) => p.tokens).map((p) => [p.a.names[0], p.b.names[0]].sort().join(' ~ '));
    assert.ok(twins.includes('--color-brand ~ --color-overdue-action'));
    assert.ok(twins.includes('--color-brand-strong ~ --color-overdue-action-hover'));
    assert.ok(twins.includes('--color-overdue-soft ~ --color-warning-soft'));
  } finally {
    writeFileSync(join(root, 'src/styles/tokens.css'), THEME);
  }
});

test('review flags each new token that twins an existing one, naming it', () => {
  writeFileSync(join(root, 'src/styles/tokens.css'), THEME_AFTER);
  try {
    const { text } = reviewData(loadKnowledge(root));
    assert.match(text, /--color-overdue-soft \(#fff4e5\) is a twin of the existing --color-warning-soft \(#fdf5e6\): 2 channel steps apart\./);
    assert.match(text, /--color-overdue-action \(#3d5ce0\) is a twin of the existing --color-brand \(#3b5bdb\): 5 channel steps apart, and the same dark value \(#6d8bff\)/);
    assert.match(text, /--color-overdue-action-hover \(#2e48b5\) is a twin of the existing --color-brand-strong/);
    // light 10 steps apart, dark identical
    assert.match(text, /--color-overdue-border has the same dark value as the existing --color-warning-border \(#4a3718\)/);
    assert.match(text, /--color-overdue-text has the same dark value as the existing --color-warning \(#f5b454\)/);
    assert.match(text, /Use --color-warning-soft \(as a class: bg-warning-soft\) and remove --color-overdue-soft/);
    // nothing in the theme is near the title colour: no twin invented
    assert.doesNotMatch(text, /--color-overdue-title/);
    // the tokens that were already there are not the change's fault
    assert.doesNotMatch(text, /--color-negative-soft|--color-surface-muted \(/);
  } finally {
    writeFileSync(join(root, 'src/styles/tokens.css'), THEME);
  }
});

test('validate reads the committed file, so an unchanged token file is clean', () => {
  const k = loadKnowledge(root);
  assert.match(validate(k, { code: THEME, file: 'src/styles/tokens.css' }), /^No measured violations found/);
  assert.match(validate(k, { code: THEME_AFTER, file: 'src/styles/tokens.css' }), /--color-overdue-soft .* twin of the existing --color-warning-soft/);
});

test('without a before, every token is judged, and none is called existing without cause', () => {
  const out = tokenTwinFindings(`:root {\n  --color-a-soft: #fdf5e6;\n  --color-b-soft: #fff4e5;\n}\n`);
  assert.equal(out.length, 1);
  assert.match(out[0].message, /^--color-b-soft \(#fff4e5\) is a twin of the token --color-a-soft/);
});

test('ramp stops, kit rows and one family never pair', () => {
  const css = `:root {
  --gray-50: #f9fafb; --slate-50: #f8fafc;
  --card: #ffffff; --popover: #fefefe;
  --color-brand: #3b5bdb; --color-brand-hover: #3a5ad9;
}\n`;
  assert.deepEqual(tokenTwinFindings(css), []);
});

test('an alias to an existing token is the fix, not a twin', () => {
  const css = `@theme {\n  --color-warning-soft: #fdf5e6;\n  --color-overdue-soft: var(--color-warning-soft);\n}\n`;
  assert.equal(tokenDefsOf(css).has('--color-overdue-soft'), false);
  assert.deepEqual(tokenTwinFindings(css, { before: '' }), []);
});

test('get_context and the build prompt say to reuse a token rather than duplicate it', () => {
  assert.match(getContext(loadKnowledge(root)), /Do not add a token that duplicates an existing one; reuse it\./);
});

// ---------- gap 2: an import of the avoided copy ----------

const PAGE_WITH_V2 = `import { Button } from '../../ui';\nimport { Button as ButtonV2 } from './ButtonV2';\nexport function InvoicesPage() { return <div className="bg-surface-muted"><Button /><ButtonV2 /></div>; }\n`;

test('validate flags a new import of the non-canonical copy, naming the canonical one', () => {
  const k = loadKnowledge(root);
  const { findings } = validateContent({ text: PAGE_WITH_V2, file: 'src/features/invoices/InvoicesPage.tsx', before: FILES['src/features/invoices/InvoicesPage.tsx'] }, k);
  const f = findings.find((x) => x.rule === 'avoided-copy');
  assert.ok(f, 'no avoided-copy finding');
  assert.equal(f.line, 2);
  assert.match(f.message, /^Imports <Button> from src\/features\/invoices\/ButtonV2\.tsx, one of 2 competing copies\. The canonical one is src\/ui\/Button\.tsx \(used \d+x; this copy \d+x\)\./);
  // the spec colour lives inside the copy: say so
  assert.match(f.message, /This copy hard-codes #3d5ce0, #2e48b5/);
  assert.match(f.fix, /^Import <Button> from src\/ui\/Button\.tsx\./);
});

test('review sees the new import through git; an import already there is not the change\'s', () => {
  writeFileSync(join(root, 'src/features/invoices/InvoicesPage.tsx'), PAGE_WITH_V2);
  // an edit to a file that already imported the copy, import untouched
  writeFileSync(join(root, 'src/features/invoices/InvoiceDetail.tsx'), FILES['src/features/invoices/InvoiceDetail.tsx'].replace('bg-canvas', 'bg-surface'));
  try {
    const { text } = reviewData(loadKnowledge(root));
    assert.match(text, /InvoicesPage\.tsx:\n[\s\S]*Imports <Button> from src\/features\/invoices\/ButtonV2\.tsx/);
    assert.doesNotMatch(text, /InvoiceDetail\.tsx:/);
  } finally {
    writeFileSync(join(root, 'src/features/invoices/InvoicesPage.tsx'), FILES['src/features/invoices/InvoicesPage.tsx']);
    writeFileSync(join(root, 'src/features/invoices/InvoiceDetail.tsx'), FILES['src/features/invoices/InvoiceDetail.tsx']);
  }
});

test('the canonical copy, a barrel and a tie are never flagged', () => {
  const k = loadKnowledge(root);
  const direct = `import { Button } from '../../ui/Button';\nexport const X = () => <Button />;\n`;
  assert.equal(validateContent({ text: direct, file: 'src/features/invoices/X.tsx' }, k).findings.filter((f) => f.rule === 'avoided-copy').length, 0);
  assert.equal(canonicalCopy([{ file: 'a.tsx', usageCount: 5 }, { file: 'b.tsx', usageCount: 4 }]), null);
  assert.equal(canonicalCopy([{ file: 'a.tsx', usageCount: 6 }, { file: 'b.tsx', usageCount: 4 }]).file, 'a.tsx');
});

test('imports resolve relatively, through an alias, and by default name', () => {
  const copies = ['src/ui/Button.tsx', 'src/features/invoices/ButtonV2.tsx'];
  assert.equal(resolveSpec('./ButtonV2', 'src/features/invoices/Page.tsx', copies), copies[1]);
  assert.equal(resolveSpec('@/features/invoices/ButtonV2', 'src/app/Page.tsx', copies), copies[1]);
  assert.equal(resolveSpec('react', 'src/app/Page.tsx', copies), null);
  const found = importsOf(`import Button, { type Props } from './ButtonV2';\nimport * as UI from '../ui';\n`);
  assert.deepEqual(found.map((i) => i.name), ['Props', 'Button']);
});

// ---------- the guard doorway (8.6.1) ----------

test('the doorway hands the guard the same lists, and the same words come out', async () => {
  const api = await import('../../skills/roast-my-design-system/scripts/lib/guard-api.mjs');
  const s = api.learnSystem(root);
  assert.ok(s.tokenDefs.some((d) => d.name === '--color-warning-soft' && d.darkValue === '#2b2112'));
  const dupe = s.duplicates.get('Button');
  assert.deepEqual(dupe.copies.map((c) => c.file).sort(), ['src/features/invoices/ButtonV2.tsx', 'src/ui/Button.tsx']);

  const k = loadKnowledge(root);
  const file = 'src/styles/tokens.css';
  const viaDoor = api.tokenTwinFindings(THEME_AFTER, { before: THEME, others: s.tokenDefs.filter((d) => d.file !== file), tailwind: true });
  const viaLive = validateContent({ text: THEME_AFTER, file, before: THEME }, k).findings.filter((f) => f.rule === 'twin-token');
  assert.equal(viaDoor.length, 5);
  assert.deepEqual(viaDoor.map((f) => f.message), viaLive.map((f) => f.message));

  const page = 'src/features/invoices/InvoicesPage.tsx';
  const door = api.avoidedImportFindings(PAGE_WITH_V2, { file: page, before: FILES[page], dupes: s.duplicates });
  const live = validateContent({ text: PAGE_WITH_V2, file: page, before: FILES[page] }, k).findings.filter((f) => f.rule === 'avoided-copy');
  assert.equal(door.length, 1);
  assert.equal(door[0].message, live[0].message);
});
