// The unused list in a shadcn catalogue folder, split by owner (9.7.0).
// shadcn's unused components are stock, installed and waiting to be used;
// a component the team wrote itself in the same folder that nothing imports
// is not stock. 178 of 2,182 listed as stock across 34 shadcn repos were the
// team's own (cal.com 38, workout-cool 27, midday 19, rallly 19). Neither
// part is scored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(HERE, '../../plugin/skills/roast-my-design-system/scripts');
const { rulesMarkdown } = await import(join(ENGINE, 'rules/build.mjs'));

function scan(extra) {
  const root = mkdtempSync(join(tmpdir(), 'roast-never-'));
  cpSync(join(HERE, '../fixtures/shadcnmixed'), root, { recursive: true });
  for (const [f, body] of Object.entries(extra)) writeFileSync(join(root, f), body);
  const h = join(root, 'h.json'), s = join(root, 's.json'), html = join(root, 'r.html');
  execFileSync(process.execPath, [join(ENGINE, 'harvest/index.mjs'), root, '--out', h], { stdio: 'ignore' });
  execFileSync(process.execPath, [join(ENGINE, 'diagnose/index.mjs'), h, '--out', html, '--summary', s], { stdio: 'ignore' });
  const out = { harvest: JSON.parse(readFileSync(h, 'utf8')), summary: JSON.parse(readFileSync(s, 'utf8')), html: readFileSync(html, 'utf8').replace(/&#39;/g, "'") };
  rmSync(root, { recursive: true, force: true });
  return out;
}
const own = (name) => `export function ${name}() { return <div className="p-2">${name}</div>; }\n`;

test("shadcn's unused components are stock; the team's own unused ones are named as its own", () => {
  const r = scan({ 'components/ui/promo-strip.tsx': own('PromoStrip'), 'components/ui/plan-picker.tsx': own('PlanPicker') });
  const stock = (r.html.match(/(\d+) shadcn components? installed but not used yet · added by the shadcn CLI/) ?? [])[1];
  assert.ok(Number(stock) >= 2, `stock ${stock}`);
  assert.match(r.html, /2 components the team wrote in components\/ui are never imported · an agent may use one of these by mistake/);
  assert.match(r.html, new RegExp(`${stock} installed by the shadcn CLI and 2 of the team's own, not used yet; not scored`));
  assert.match(r.html, /2 components the team wrote in the same folder are not imported either\. They are listed under the adoption map and are not scored\./);
  // the own list holds only the team's files, the stock list only shadcn's
  const ownBlock = r.html.split("the team wrote in components/ui are never imported")[1].split('</div></div>')[0];
  assert.match(ownBlock, /PromoStrip/);
  assert.doesNotMatch(ownBlock, /&lt;Dialog&gt;|&lt;Tabs&gt;/);
  // not scored, as before: the tile stays information
  assert.equal(r.summary.tiles.find((t) => t.metric === 'neverImported').health, 'info');
  const rules = rulesMarkdown(r.harvest).text;
  assert.match(rules, /### Catalogue components already installed\n\n- \d+ components are installed and unused in `components\/ui`/);
  assert.match(rules, /### Components nobody imports\n\n- 2 components are defined but never imported \(`<PlanPicker>`, `<PromoStrip>`…\)|### Components nobody imports\n\n- 2 components are defined but never imported \(`<PromoStrip>`, `<PlanPicker>`…\)/);
  assert.doesNotMatch(rules.split('### Catalogue components already installed')[1].split('###')[0], /PromoStrip|PlanPicker/);
});

test('with only shadcn stock unused, the words are as before', () => {
  const r = scan({});
  assert.doesNotMatch(r.html, /of the team's own|the team wrote/);
  assert.match(r.html, /catalogue stock: installed by the shadcn CLI, not used yet/);
  assert.doesNotMatch(rulesMarkdown(r.harvest).text, /Components nobody imports/);
});
