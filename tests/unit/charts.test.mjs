// Chart colours: one rule for the report, the live checks and the guard.
// Three tiers (lib/charts.mjs): a palette to use, a precedent and a gap, or
// the first chart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadKnowledge } from '../../skills/roast-my-design-system/scripts/mcp/knowledge.mjs';
import { validateContent } from '../../skills/roast-my-design-system/scripts/mcp/engine.mjs';
import { isChartFile, chartTier } from '../../skills/roast-my-design-system/scripts/lib/charts.mjs';
import { learnSystem } from '../../skills/roast-my-design-system/scripts/lib/guard-api.mjs';

for (const v of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete process.env[v];

const TOKENS = `:root {\n  --color-brand: #3b5bdb;\n  --color-ink: #101828;\n  --color-surface: #ffffff;\n  --color-muted: #667085;\n}\n`;
const BUTTON = `export function Button(p) { return <button className="btn" style={{ color: 'var(--color-brand)' }}>{p.children}</button>; }\n`;
const uses = (n) => `import { Button } from '../components/Button';\nexport default function Page() { return <div>${'<Button />'.repeat(n)}</div>; }\n`;
const OLD_CHART = `import { BarChart, Bar } from 'recharts';\nconst SERIES = ['#2563eb', '#16a34a', '#f59e0b'];\nexport function OldChart() { return <BarChart>{SERIES.map((c) => <Bar key={c} fill={c} />)}</BarChart>; }\n`;
const NEW_CHART = `import { PieChart, Pie } from 'recharts';\nconst COLORS = ['#7c3aed', '#db2777', '#0891b2', '#ea580c'];\nexport function Donut() { return <PieChart><Pie fill={COLORS[0]} /></PieChart>; }\n`;

function repo(extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'roast-charts-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'charty', dependencies: { react: '18.0.0', recharts: '2.0.0' } }));
  mkdirSync(join(dir, 'styles')); mkdirSync(join(dir, 'components')); mkdirSync(join(dir, 'pages'));
  writeFileSync(join(dir, 'styles/tokens.css'), TOKENS + (extra.css ?? ''));
  writeFileSync(join(dir, 'components/Button.tsx'), BUTTON);
  writeFileSync(join(dir, 'pages/a.tsx'), uses(3));
  for (const [f, t] of Object.entries(extra.files ?? {})) writeFileSync(join(dir, f), t);
  return dir;
}
const judge = (dir, file, text) => validateContent({ text, file, before: null }, loadKnowledge(dir)).findings;
const rules = (fs) => fs.map((f) => f.rule);

test('a chart file is known by its import or its name, not by graphql or an icon', () => {
  assert.ok(isChartFile('ui/Thing.tsx', "import { Bar } from 'recharts';"));
  assert.ok(isChartFile('ui/clicks-by-country-chart.tsx', ''));
  assert.ok(isChartFile('ui/Sparkline.tsx', ''));
  assert.ok(!isChartFile('lib/graphql-client.ts', ''));
  assert.ok(!isChartFile('icons/bar-chart.tsx', "import { Bar } from 'recharts';"));
  assert.ok(!isChartFile('ui/Chart.stories.tsx', "import { Bar } from 'recharts';"));
});

test('tier 1: a palette with its own names turns every hand-written chart colour into a finding that names it', () => {
  const dir = repo({ css: `:root {\n  --chart-1: #2563eb;\n  --chart-2: #16a34a;\n  --series-3: hsl(38 92% 50%);\n  --chart-help: 'pick a range';\n  --chart-gap: 4px;\n}\n` });
  const k = loadKnowledge(dir);
  assert.deepEqual(k.charts.palette.names, ['--chart-1', '--chart-2', '--series-3'], 'a value that is not a colour is not a palette entry');
  assert.equal(chartTier(k.charts), 1);
  const fs = judge(dir, 'components/Donut.tsx', NEW_CHART);
  assert.deepEqual(rules(fs), ['chart-colour', 'chart-colour', 'chart-colour', 'chart-colour']);
  assert.match(fs[0].message, /keeps a chart palette \(--chart-1, --chart-2, --series-3 in styles\/tokens\.css\)/);
  assert.match(fs[0].fix, /var\(--chart-1\)/);
  assert.ok(!rules(fs).includes('hardcoded-colour'), 'the generic colour check stays out of a chart file');
  rmSync(dir, { recursive: true, force: true });
});

test('tier 2: no palette but a chart that paints by hand is a precedent and a gap, one warning', () => {
  const dir = repo({ files: { 'components/OldChart.tsx': OLD_CHART } });
  const k = loadKnowledge(dir);
  assert.equal(k.charts.palette, null);
  assert.equal(k.charts.precedents[0].file, 'components/OldChart.tsx');
  assert.equal(chartTier(k.charts), 2);
  const fs = judge(dir, 'components/Donut.tsx', NEW_CHART);
  assert.equal(fs.length, 1);
  assert.equal(fs[0].rule, 'chart-palette');
  assert.equal(fs[0].severity, 'warning');
  assert.match(fs[0].message, /4 series colours by hand \(#7c3aed, #db2777, #0891b2, #ea580c\); the repo has no chart palette, and components\/OldChart\.tsx already does the same with 3/);
  assert.match(fs[0].fix, /Name these once as chart tokens .* in styles\/tokens\.css.* and in components\/OldChart\.tsx/);
  rmSync(dir, { recursive: true, force: true });
});

test('shadcn default --chart-1..5 that no chart reads is a gap with the fix ready-made', () => {
  const css = `:root {\n  --chart-1: 220 70% 50%;\n  --chart-2: 160 60% 45%;\n  --chart-3: 30 80% 55%;\n  --chart-4: 280 65% 60%;\n  --chart-5: 340 75% 55%;\n}\n`;
  const dir = repo({ css, files: { 'components/OldChart.tsx': OLD_CHART } });
  const k = loadKnowledge(dir);
  assert.equal(k.charts.palette.shadcnDefault, true);
  assert.equal(k.charts.palette.referenced, false);
  assert.equal(chartTier(k.charts), 2);
  const fs = judge(dir, 'components/Donut.tsx', NEW_CHART);
  assert.equal(fs.length, 1);
  assert.match(fs[0].fix, /already defines --chart-1 to --chart-5 in styles\/tokens\.css and no chart reads them/);
  rmSync(dir, { recursive: true, force: true });
});

test('shadcn default --chart-1..5 that a chart reads is the palette', () => {
  const css = `:root {\n  --chart-1: 220 70% 50%;\n  --chart-2: 160 60% 45%;\n}\n`;
  const reads = `import { Bar } from 'recharts';\nexport function Usage() { return <Bar fill="hsl(var(--chart-1))" />; }\n`;
  const dir = repo({ css, files: { 'components/UsageChart.tsx': reads } });
  const k = loadKnowledge(dir);
  assert.equal(k.charts.palette.referenced, true);
  assert.equal(chartTier(k.charts), 1);
  assert.deepEqual(rules(judge(dir, 'components/Donut.tsx', NEW_CHART)), ['chart-colour', 'chart-colour', 'chart-colour', 'chart-colour']);
  rmSync(dir, { recursive: true, force: true });
});

test('tier 3: the first chart in a repo gets one warning asking for a name, not four violations', () => {
  const dir = repo();
  const k = loadKnowledge(dir);
  assert.equal(chartTier(k.charts), 3);
  const fs = judge(dir, 'components/Donut.tsx', NEW_CHART);
  assert.equal(fs.length, 1);
  assert.equal(fs[0].severity, 'warning');
  assert.match(fs[0].message, /First chart in this repo: 4 series colours written by hand/);
  rmSync(dir, { recursive: true, force: true });
});

test('a chart that reads the palette is clean, and a non-chart file is judged as before', () => {
  const dir = repo({ css: `:root {\n  --chart-1: #2563eb;\n  --chart-2: #16a34a;\n}\n` });
  const clean = `import { Bar } from 'recharts';\nexport function Good() { return <Bar fill="var(--chart-1)" />; }\n`;
  assert.deepEqual(judge(dir, 'components/Good.tsx', clean), []);
  const plain = `export function Card() { return <div style={{ color: '#7c3aed' }}>x</div>; }\n`;
  assert.ok(rules(judge(dir, 'components/Card.tsx', plain)).includes('hardcoded-colour'));
  rmSync(dir, { recursive: true, force: true });
});

test('the guard doorway learns the same chart system as the MCP knowledge', () => {
  const dir = repo({ files: { 'components/OldChart.tsx': OLD_CHART } });
  const g = learnSystem(dir), k = loadKnowledge(dir);
  assert.deepEqual(g.charts, k.charts);
  rmSync(dir, { recursive: true, force: true });
});

test('installed kit code is never a chart precedent: a fresh shadcn install has no chart gap', () => {
  const fresh = join(process.cwd(), 'tests/fixtures/shadcnfresh');
  const k = loadKnowledge(fresh);
  assert.deepEqual(k.charts.precedents, []);
  assert.deepEqual(k.gaps, []);
  assert.deepEqual(learnSystem(fresh).gaps, []);
});
