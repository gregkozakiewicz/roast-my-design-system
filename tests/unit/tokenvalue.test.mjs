// A token's raw value pasted into a component is a hardcoded colour, even
// though the system knows the value. Until 9.1.3 every exact match walked
// free, and hooked agents on Twenty wrote background: #4a38f5 (a token value)
// with a clean bill, then told the user they had used tokens (2026-09-29).
// The skip survives only inside the files that state the palette.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { loadKnowledge } from '../../plugin/skills/roast-my-design-system/scripts/mcp/knowledge.mjs';
import { validateContent } from '../../plugin/skills/roast-my-design-system/scripts/mcp/engine.mjs';
import { learnSystem } from '../../plugin/skills/roast-my-design-system/scripts/lib/guard-api.mjs';

for (const v of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete process.env[v];

const THEME = `:root {
  --color-canvas: #f5f6f8;
  --color-surface: #ffffff;
  --color-ink: #101828;
  --color-brand: #3b5bdb;
  --color-brand-strong: #2f49b8;
  --color-muted: #6b7280;
}
`;
const FILES = {
  'package.json': JSON.stringify({ name: 'ledgerly', private: true, dependencies: { react: '^19.0.0' } }),
  'src/styles/tokens.css': THEME,
  'src/styles/site.css': '.card { color: var(--color-ink); background: var(--color-surface); }\n',
  'src/ui/Button.tsx': 'export function Button(props) { return <button className="btn" {...props} />; }\n',
  'src/ui/index.ts': "export { Button } from './Button';\n",
  'src/pages/Home.tsx': "import { Button } from '../ui';\nexport function Home() { return <div><Button /><Button /></div>; }\n",
};

const root = mkdtempSync(join(tmpdir(), 'roast-tokenvalue-'));
for (const [f, body] of Object.entries(FILES)) {
  mkdirSync(join(root, dirname(f)), { recursive: true });
  writeFileSync(join(root, f), body);
}
const k = loadKnowledge(root);
const colours = (findings) => findings.filter((f) => f.rule === 'hardcoded-colour' || f.rule === 'near-token-twin');

test('the theme is known and its stylesheet is a token source', () => {
  assert.equal(k.colorInfo.get('#3b5bdb')?.isToken, true);
  assert.ok(k.tokenSources.has('src/styles/tokens.css'), [...k.tokenSources].join(', '));
  assert.ok(!k.tokenSources.has('src/pages/Home.tsx'));
});

test('a component pasting a token value is told to use the token by name', () => {
  const text = "export const Settings = () => <div style={{ background: '#3b5bdb', color: '#6b7280' }}>s</div>;\n";
  const { findings } = validateContent({ text, file: 'src/pages/Settings.tsx', before: null }, k);
  const got = colours(findings);
  assert.equal(got.length, 2, JSON.stringify(findings));
  assert.match(got[0].message, /Hardcoded colour #3b5bdb duplicates an existing token value/);
  assert.match(got[0].fix, /--color-brand/);
  assert.match(got[0].fix, /src\/styles\/tokens\.css/);
  assert.match(got[1].fix, /--color-muted/);
  assert.equal(got[0].severity, 'violation');
});

test('a stylesheet pasting a token value is told the var() to use', () => {
  const text = '.hero { background: #3b5bdb; }\n';
  const { findings } = validateContent({ text, file: 'src/styles/hero.css', before: null }, k);
  const got = colours(findings);
  assert.equal(got.length, 1, JSON.stringify(findings));
  assert.match(got[0].fix, /var\(--color-brand\)/);
});

test('the token stylesheet writing its own values stays silent', () => {
  const { findings } = validateContent({ text: THEME, file: 'src/styles/tokens.css', before: THEME }, k);
  assert.deepEqual(colours(findings), []);
  // a new token added to the sheet, whose value already exists: still not a
  // hardcoded colour (the twin check is the one that speaks to that)
  const added = THEME.replace('}\n', '  --color-link: #3b5bdb;\n}\n');
  assert.deepEqual(colours(validateContent({ text: added, file: 'src/styles/tokens.css', before: THEME }, k).findings), []);
});

test('a Tailwind config stating the palette in code stays silent, a component does not', () => {
  const dir = mkdtempSync(join(tmpdir(), 'roast-tokenvalue-tw-'));
  const CONFIG = "module.exports = { theme: { extend: { colors: { brand: '#3b5bdb', ink: '#101828', canvas: '#f5f6f8' } } } };\n";
  const F = {
    'package.json': JSON.stringify({ name: 'twin', private: true, dependencies: { react: '^19.0.0', tailwindcss: '^3.4.0' } }),
    'tailwind.config.js': CONFIG,
    'src/ui/Button.tsx': 'export function Button(props) { return <button className="bg-brand text-canvas" {...props} />; }\n',
    'src/pages/Home.tsx': "import { Button } from '../ui/Button';\nexport function Home() { return <div className=\"bg-canvas text-ink\"><Button /></div>; }\n",
  };
  for (const [f, body] of Object.entries(F)) {
    mkdirSync(join(dir, dirname(f)), { recursive: true });
    writeFileSync(join(dir, f), body);
  }
  const kt = loadKnowledge(dir);
  assert.ok(kt.tokenSources.has('tailwind.config.js'), [...kt.tokenSources].join(', '));
  const edited = CONFIG.replace("canvas: '#f5f6f8'", "canvas: '#f5f6f8', link: '#3b5bdb'");
  assert.deepEqual(colours(validateContent({ text: edited, file: 'tailwind.config.js', before: CONFIG }, kt).findings), []);
  const page = "export const Settings = () => <div style={{ background: '#3b5bdb' }}>s</div>;\n";
  const got = colours(validateContent({ text: page, file: 'src/pages/Settings.tsx', before: null }, kt).findings);
  assert.equal(got.length, 1, JSON.stringify(got));
  assert.match(got[0].message, /duplicates an existing token value/);
  rmSync(dir, { recursive: true, force: true });
});

test('a colour that is not a token is still judged as before', () => {
  const text = "export const S = () => <div style={{ background: '#123456' }}>s</div>;\n";
  const got = colours(validateContent({ text, file: 'src/pages/S.tsx', before: null }, k).findings);
  assert.equal(got.length, 1);
  assert.match(got[0].message, /is new to this repo/);
});

test('the guard doorway lists the same token sources', () => {
  const s = learnSystem(root);
  assert.deepEqual(s.tokenSources, ['src/styles/tokens.css']);
});

test.after(() => rmSync(root, { recursive: true, force: true }));
