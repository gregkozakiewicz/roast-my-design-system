// The colour-use bar end to end, through the harvest and the report: the two
// decisions made outside harvest/coloruse.mjs (9.7.0).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, writeFileSync, rmSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixture } from './_fixture.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(HERE, '../../skills/roast-my-design-system/scripts');
const scan = (root) => {
  execFileSync(process.execPath, [join(ENGINE, 'harvest/index.mjs'), root, '--out', join(root, 'h.json')], { stdio: 'ignore' });
  execFileSync(process.execPath, [join(ENGINE, 'diagnose/index.mjs'), join(root, 'h.json'), '--out', join(root, 'r.html'), '--summary', join(root, 's.json')], { stdio: 'ignore' });
  return { harvest: JSON.parse(readFileSync(join(root, 'h.json'), 'utf8')), html: readFileSync(join(root, 'r.html'), 'utf8').replace(/&#39;/g, "'") };
};

// Bootstrap's text-white is not Tailwind's palette (prometheus, backstage)
test('the harvest reads palette classes only where the repo shows Tailwind', () => {
  const make = (deps) => {
    const root = mkdtempSync(join(tmpdir(), 'roast-use-tw-'));
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'x', dependencies: { react: '18.0.0', ...deps } }));
    writeFileSync(join(root, 'src/app.css'), ':root { --ink: #222222; }\n.title { color: var(--ink); }\n');
    writeFileSync(join(root, 'src/App.tsx'), `export const App = () => <div className="text-white bg-black text-gray-500">${'<p className="text-white" />'.repeat(5)}</div>;\n`);
    return root;
  };
  const plain = make({ bootstrap: '5.3.0' }), tw = make({ tailwindcss: '4.0.0' });
  try {
    assert.equal(scan(plain).harvest.colourUse.totals.palette, 0);
    assert.ok(scan(tw).harvest.colourUse.totals.palette > 0);
  } finally { rmSync(plain, { recursive: true, force: true }); rmSync(tw, { recursive: true, force: true }); }
});

// a dark: override of white or black, where the theme already has dark rows
test('a dark: override tooltip says the theme already sets its own dark-mode colours, where it does', () => {
  const root = mkdtempSync(join(tmpdir(), 'roast-use-dark-'));
  try {
    cpSync(fixture('shadcnfresh'), root, { recursive: true });
    writeFileSync(join(root, 'app/own.tsx'), `export const Own = () => <div className="dark:bg-black">${'<p className="text-primary bg-background" />'.repeat(15)}</div>;\n`);
    const { html } = scan(root);
    assert.match(html, /title="black ×1 as dark: overrides written by hand, where the theme already sets its own dark-mode colours/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
