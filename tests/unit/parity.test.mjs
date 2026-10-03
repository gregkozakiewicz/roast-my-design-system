// The report and the live checks are two judges reading one repo, and they
// must excuse the same things. Until 9.2.1 the report knew that a framework's
// Route repeats by design, that a wrapper and two icon libraries colliding
// are listed and never counted, that a file with no markup holds no
// component, and that bracket values inside the shadcn catalogue are
// shadcn's own. The live checks knew none of it: on shadcn-admin 31 of 89
// live findings were "Defines <Route>, which already exists in 40 other
// places", and the catalogue's tooltip was told off for its [2px]
// (2026-09-29). The duplicate question now has one answer, in
// harvest/duplicates.mjs, and the last test here fails if the two judges
// drift apart again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadKnowledge } from '../../plugin/skills/roast-my-design-system/scripts/mcp/knowledge.mjs';
import { validateContent } from '../../plugin/skills/roast-my-design-system/scripts/mcp/engine.mjs';
import { canBeDuplicate, duplicateCopies, isPageFile, looksLikeJSXFile } from '../../plugin/skills/roast-my-design-system/scripts/lib/guard-api.mjs';

for (const v of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete process.env[v];
const HERE = dirname(fileURLToPath(import.meta.url));

const route = (path, name) => `import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('${path}')({ component: ${name} });
function ${name}() { return <main className="p-4">${name}</main>; }
`;
const FILES = {
  'package.json': JSON.stringify({ name: 'dashboard', private: true, dependencies: { react: '^19.0.0', '@tanstack/react-router': '^1.0.0' } }),
  'src/styles/tokens.css': ':root { --color-ink: #101828; --color-surface: #ffffff; }\n',
  'src/routes/__root.tsx': route('/', 'Root'),
  'src/routes/_app/tasks/index.tsx': route('/tasks', 'Tasks'),
  'src/routes/_app/users/index.tsx': route('/users', 'Users'),
  'src/routes/_app/apps/index.tsx': route('/apps', 'Apps'),
  'src/ui/Card.tsx': 'export function Card(props) { return <div className="card" {...props} />; }\n',
  'src/features/tasks/Card.tsx': 'export function Card(props) { return <section className="card" {...props} />; }\n',
  'src/ui/Card.stories.tsx': 'export function Card() { return <div className="card">demo</div>; }\n',
  // a wrapper: the second EmptyState is built on the first
  'src/ui/EmptyState.tsx': 'export function EmptyState(props) { return <div className="empty" {...props} />; }\n',
  'src/features/tasks/EmptyState.tsx': "import { EmptyState as Base } from '../../ui/EmptyState';\nexport function EmptyState(props) { return <Base tone=\"quiet\" {...props} />; }\n",
  // two icon libraries carrying the same glyph
  'src/icons/Check.tsx': 'export function Check() { return <svg viewBox="0 0 16 16"><path d="M2 8l4 4 8-8" /></svg>; }\n',
  'src/brand/icons/Check.tsx': 'export function Check() { return <svg viewBox="0 0 24 24"><path d="M3 12l6 6 12-12" /></svg>; }\n',
  // an icon named for what it shows, beside the component of the same name
  'src/icons/Switch.tsx': 'export function Switch() { return <svg viewBox="0 0 16 16"><path d="M4 8h8" /></svg>; }\n',
  'src/ui/Switch.tsx': 'export function Switch(props) { return <button role="switch" className="switch" {...props} />; }\n',
  // the same glyph twice: an icon, and a control that draws its own
  'src/icons/Checkmark.tsx': 'export function Checkmark() { return <svg viewBox="0 0 16 16"><path d="M2 8l4 4 8-8" /></svg>; }\n',
  'src/player/RateControl.tsx': 'export function Checkmark() { return <svg viewBox="0 0 16 16"><path d="M2 8l4 4 8-8" /></svg>; }\nexport function RateControl() { return <button className="rate"><Checkmark /></button>; }\n',
  // one icon set in subfolders: aws/ and gcp/ each draw a Batch
  'src/icons/aws/Batch.tsx': 'export function Batch() { return <svg viewBox="0 0 16 16"><path d="M1 1h14" /></svg>; }\n',
  'src/icons/gcp/Batch.tsx': 'export function Batch() { return <svg viewBox="0 0 16 16"><path d="M2 2h12" /></svg>; }\n',
  // a stub with no markup in it
  'src/templates/Card.tsx': 'export function Card() {\n  return null;\n}\n',
  // a drawing, twice: the styling is exempt, the second copy is still a copy
  'src/brand/Logo.tsx': 'export function Logo() { return <svg viewBox="0 0 32 32"><path fill="#ff5a1f" d="M4 4h24v24H4z" /></svg>; }\n',
  'src/marketing/Logo.tsx': 'export function Logo() { return <svg viewBox="0 0 32 32"><path fill="#ff5a1f" d="M6 6h20v20H6z" /></svg>; }\n',
  // a screen about email is interface; an email template is not
  'src/features/users/ConfirmUserEmail.tsx': 'export function ConfirmUserEmail() { return <p className="note">Check your inbox</p>; }\n',
  'src/features/invites/ConfirmUserEmail.tsx': 'export function ConfirmUserEmail() { return <p className="note">We sent a link</p>; }\n',
  'packages/acme-emails/src/Footer.tsx': 'export function Footer() { return <table><tbody><tr><td style={{ color: "#667085" }}>Acme</td></tr></tbody></table>; }\n',
  'src/ui/Footer.tsx': 'export function Footer() { return <footer className="footer">Acme</footer>; }\n',
  // the crash page, and a starter template of it
  'src/app/global-error.tsx': 'export default function GlobalError() { return <html><body><h2 style={{ color: "#b42318" }}>Something went wrong</h2></body></html>; }\n',
  'scripts/starter/src/app/global-error.tsx': 'export default function GlobalError() { return <html><body><h2 style={{ color: "#b42318" }}>Something went wrong</h2></body></html>; }\n',
  // web components, registered by tag
  'src/wc/nav-item.ts': "import { LitElement, html } from 'lit';\nexport class NavItem extends LitElement { render() { return html`<slot></slot>`; } }\ncustomElements.define('acme-nav-item', NavItem);\n",
  'src/wc-next/nav-item.ts': "import { LitElement, html } from 'lit';\nexport class NavItem extends LitElement { render() { return html`<slot></slot>`; } }\ncustomElements.define('acme-nav-item', NavItem);\n",
};
const root = mkdtempSync(join(tmpdir(), 'roast-parity-'));
for (const [f, body] of Object.entries(FILES)) {
  mkdirSync(join(root, dirname(f)), { recursive: true });
  writeFileSync(join(root, f), body);
}
const k = loadKnowledge(root);
const judge = (knowledge, base, file) => validateContent({ text: readFileSync(join(base, file), 'utf8'), file, before: null }, knowledge).findings;
const dupes = (findings) => findings.filter((f) => f.rule === 'duplicate-component');

test('a route file is not told its Route already exists', () => {
  for (const f of Object.keys(FILES).filter((x) => x.startsWith('src/routes/'))) {
    assert.deepEqual(dupes(judge(k, root, f)), [], f);
  }
});

test('a new route file an agent writes is not told either', () => {
  const { findings } = validateContent({ text: route('/billing', 'Billing'), file: 'src/routes/_app/billing/index.tsx', before: null }, k);
  assert.deepEqual(dupes(findings), []);
});

test('a second Card in own code is still a duplicate', () => {
  const got = dupes(judge(k, root, 'src/features/tasks/Card.tsx'));
  assert.equal(got.length, 1, JSON.stringify(got));
  assert.match(got[0].message, /Defines <Card>, but src\/ui\/Card\.tsx already defines it/);
});

test('a story is neither a duplicate nor the copy a duplicate is measured against', () => {
  assert.deepEqual(dupes(judge(k, root, 'src/ui/Card.stories.tsx')), []);
  const { findings } = validateContent({ text: 'export function Badge() { return <span className="badge" />; }\n', file: 'src/ui/Badge.tsx', before: null }, k);
  assert.deepEqual(dupes(findings), []);
});

test('a wrapper is listed by the report and is not a finding on either file', () => {
  const entry = k.duplicates.exactDuplicates.find((d) => d.name === 'EmptyState');
  assert.equal(entry?.wrapped, true, 'the report must read the pair as a wrapper for this to prove anything');
  assert.deepEqual(dupes(judge(k, root, 'src/features/tasks/EmptyState.tsx')), []);
  assert.deepEqual(dupes(judge(k, root, 'src/ui/EmptyState.tsx')), []);
});

test('two icon libraries colliding are one problem, not a finding per icon', () => {
  assert.ok(k.duplicates.iconCollisions.some((d) => d.name === 'Check'), 'the report must read the pair as an icon collision');
  assert.deepEqual(dupes(judge(k, root, 'src/icons/Check.tsx')), []);
  assert.deepEqual(dupes(judge(k, root, 'src/brand/icons/Check.tsx')), []);
  // an icon not saved yet, joining the collision
  const { findings } = validateContent({ text: FILES['src/icons/Check.tsx'], file: 'src/marketing/icons/Check.tsx', before: null }, k);
  assert.deepEqual(dupes(findings), []);
});

test('an icon is not a second copy of the component it is named after', () => {
  assert.ok(!k.duplicates.exactDuplicates.some((d) => d.name === 'Switch'), 'the report must not count the pair');
  assert.deepEqual(dupes(judge(k, root, 'src/icons/Switch.tsx')), []);
  assert.deepEqual(dupes(judge(k, root, 'src/ui/Switch.tsx')), []);
  // an icon not saved yet, named like the component
  const { findings } = validateContent({ text: FILES['src/icons/Switch.tsx'], file: 'src/icons/Toggle/Switch.tsx', before: null }, k);
  assert.deepEqual(dupes(findings), []);
  // and a second component of that name is still a copy
  const second = validateContent({ text: FILES['src/ui/Switch.tsx'], file: 'src/features/settings/Switch.tsx', before: null }, k);
  assert.equal(dupes(second.findings).length, 1);
});

test('one icon set in subfolders is not two sets colliding', () => {
  assert.ok(!k.duplicates.iconCollisions.some((d) => d.name === 'Batch'), 'aws/ and gcp/ are one set');
  assert.ok(!k.duplicates.exactDuplicates.some((d) => d.name === 'Batch'));
  assert.deepEqual(dupes(judge(k, root, 'src/icons/aws/Batch.tsx')), []);
});

test('the same logo drawn twice is still two copies', () => {
  assert.ok(k.duplicates.exactDuplicates.some((d) => d.name === 'Logo'));
});

test('an icon and a component drawing the same glyph are two copies', () => {
  assert.ok(k.duplicates.exactDuplicates.some((d) => d.name === 'Checkmark'), 'remotion kept a Checkmark icon and drew one again in a control');
  assert.equal(dupes(judge(k, root, 'src/player/RateControl.tsx')).length, 1);
});

test('a file with no markup holds no component, as in the report', () => {
  assert.ok(!k.components.some((c) => c.file === 'src/templates/Card.tsx'), 'the ledger must leave the stub out');
  assert.deepEqual(dupes(judge(k, root, 'src/templates/Card.tsx')), []);
});

test('an exempt file is still judged on duplicates, and says that is all it was judged on', () => {
  const r = validateContent({ text: FILES['src/marketing/Logo.tsx'], file: 'src/marketing/Logo.tsx', before: null }, k);
  assert.match(r.exempt, /artwork|drawing/);
  assert.deepEqual(r.findings.map((f) => f.rule), ['duplicate-component'], 'the colour in the drawing is not judged, the second Logo is');
  assert.deepEqual(r.checked, ['duplicate component definitions']);
});

test('a screen about email is interface, an email template is not', () => {
  assert.equal(dupes(judge(k, root, 'src/features/invites/ConfirmUserEmail.tsx')).length, 1);
  assert.deepEqual(dupes(judge(k, root, 'packages/acme-emails/src/Footer.tsx')), []);
  assert.deepEqual(dupes(judge(k, root, 'src/ui/Footer.tsx')), [], 'the web Footer is not measured against the email one');
  for (const f of ['emails/Welcome.tsx', 'src/email-templates/Welcome.tsx', 'packages/acme-emails/src/Welcome.tsx', 'src/mail/welcome-email.tsx', 'src/react_email/Welcome.tsx']) {
    assert.equal(canBeDuplicate({ name: 'Welcome', file: f }), false, f);
  }
  for (const f of ['src/features/users/ConfirmUserEmail.tsx', 'src/ui/EmailInput.tsx', 'src/features/EmailSettings/Form.tsx']) {
    assert.equal(canBeDuplicate({ name: 'Form', file: f }), true, f);
  }
});

test('the crash page repeats by design', () => {
  assert.ok(!k.duplicates.exactDuplicates.some((d) => d.name === 'GlobalError'));
  assert.deepEqual(dupes(judge(k, root, 'src/app/global-error.tsx')), []);
});

test('a web component registered twice is a duplicate to both judges', () => {
  assert.ok(k.duplicates.exactDuplicates.some((d) => d.name === 'NavItem' && !d.wrapped), 'the report must count the pair');
  assert.equal(dupes(judge(k, root, 'src/wc-next/nav-item.ts')).length, 1);
});

test('content not saved yet is judged on the copies that exist', () => {
  const { findings } = validateContent({ text: 'export function Card(p) { return <article className="card" {...p} />; }\n', file: 'src/features/users/Card.tsx', before: null }, k);
  assert.equal(dupes(findings).length, 1, JSON.stringify(findings));
  const wrapperName = validateContent({ text: 'export function EmptyState() { return <div className="empty">none</div>; }\n', file: 'src/features/users/EmptyState.tsx', before: null }, k);
  assert.equal(dupes(wrapperName.findings).length, 1, 'a third EmptyState is a copy, whatever the first two are to each other');
});

test('the doorway answers the same question for a guard', () => {
  assert.equal(canBeDuplicate({ name: 'Route', file: 'src/routes/_app/tasks/index.tsx' }), false);
  assert.equal(canBeDuplicate({ name: 'Card', file: 'src/ui/Card.stories.tsx' }), false);
  assert.equal(canBeDuplicate({ name: 'Card', file: 'src/app/settings/page.tsx', isPage: isPageFile('src/app/settings/page.tsx') }), false);
  assert.equal(canBeDuplicate({ name: 'Card', file: 'src/features/tasks/Card.tsx' }), true);
  const copies = k.components.filter((c) => c.name === 'Card');
  const counted = k.duplicates.exactDuplicates.find((d) => d.name === 'Card' && !d.wrapped)?.files ?? null;
  assert.deepEqual(duplicateCopies({ name: 'Card', file: 'src/features/tasks/Card.tsx' }, copies, counted).map((c) => c.file), ['src/ui/Card.tsx']);
  // a guard compares paths by their tails
  const tails = (a, b) => a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`);
  assert.equal(duplicateCopies({ name: 'Card', file: 'features/tasks/Card.tsx' }, copies, counted, tails).length, 1);
  assert.equal(looksLikeJSXFile(FILES['src/templates/Card.tsx']), false);
});

// ---------- installed code ----------
const factory = join(HERE, '..', 'fixtures', 'shadcnfactory');
const kf = loadKnowledge(factory);
const installedFiles = kf.files.code.filter((f) => /\.(tsx|jsx)$/.test(f) && kf.installedDirs.some((d) => f.startsWith(`${d}/`)));

test('the knowledge names the installed folders', () => {
  assert.deepEqual(kf.installedDirs, ['components/ui']);
  assert.deepEqual(k.installedDirs, [], 'a repo with no kit has no installed code');
});

test('bracket values inside the shadcn catalogue are not findings', () => {
  const withBrackets = installedFiles.filter((f) => /\[[\d.]+(px|rem|%)\]/.test(readFileSync(join(factory, f), 'utf8')));
  assert.ok(withBrackets.length > 0, 'the fixture must carry catalogue brackets for this to prove anything');
  for (const f of withBrackets) {
    assert.deepEqual(judge(kf, factory, f).filter((x) => x.rule === 'arbitrary-value'), [], f);
  }
});

test('the same bracket value in own code is still a finding', () => {
  const { findings } = validateContent({ text: 'export function Hero() { return <div className="h-[13px] w-full" />; }\n', file: 'components/hero.tsx', before: null }, kf);
  assert.equal(findings.filter((f) => f.rule === 'arbitrary-value').length, 1, JSON.stringify(findings));
});

// ---------- the two judges, side by side ----------
test('on every file the live checks and the report name the same duplicates', () => {
  for (const [knowledge, base] of [[k, root], [kf, factory]]) {
    // what the report counts: every copy of every duplicate that is not a wrapped pair
    const counted = new Set();
    for (const d of (knowledge.duplicates.exactDuplicates ?? []).filter((x) => !x.wrapped)) {
      for (const f of d.files) counted.add(`${d.name} in ${typeof f === 'string' ? f : f.file}`);
    }
    const live = new Set();
    for (const f of knowledge.files.code.filter((x) => /\.(tsx|jsx|ts|js|mjs)$/.test(x))) {
      const findings = judge(knowledge, base, f);
      for (const d of dupes(findings)) live.add(`${d.message.match(/Defines <([^>]+)>/)?.[1]} in ${f}`);
      if (knowledge.installedDirs.some((dir) => f.startsWith(`${dir}/`))) {
        assert.deepEqual(findings.filter((x) => x.rule === 'arbitrary-value'), [], `${f}: a bracket value in installed code`);
      }
    }
    assert.deepEqual([...live].sort(), [...counted].sort());
  }
});
