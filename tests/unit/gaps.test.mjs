// Where agents will invent: the gap report (lib/gaps.mjs), through every door.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { designGaps } from '../../skills/roast-my-design-system/scripts/lib/gaps.mjs';
import { loadKnowledge } from '../../skills/roast-my-design-system/scripts/mcp/knowledge.mjs';
import { getContext } from '../../skills/roast-my-design-system/scripts/mcp/tools.mjs';
import { learnSystem } from '../../skills/roast-my-design-system/scripts/lib/guard-api.mjs';

for (const v of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete process.env[v];
const BIN = join(process.cwd(), 'cli/roast.mjs');

const precedents = [{ file: 'ui/Sales.tsx', count: 6, sample: ['#111111', '#222222', '#333333'] }, { file: 'ui/Usage.tsx', count: 3, sample: [] }];

test('charts painting by hand with no palette is a gap that names the files and the fix', () => {
  const [g] = designGaps({ charts: { palette: null, precedents, chartFiles: 2 }, tokenFile: 'styles/tokens.css' });
  assert.equal(g.id, 'chart-palette');
  assert.equal(g.title, 'Charts have no palette');
  assert.match(g.detail, /2 chart files paint 9 series colours by hand \(ui\/Sales\.tsx \(6\), ui\/Usage\.tsx \(3\)\)/);
  assert.match(g.fix, /--chart-1, --chart-2 … in styles\/tokens\.css/);
  assert.deepEqual(g.files, ['ui/Sales.tsx', 'ui/Usage.tsx']);
});

test('shadcn names that no chart reads are the same gap with the fix ready-made', () => {
  const palette = { names: ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5'], file: 'app/globals.css', shadcnDefault: true, referenced: false };
  const [g] = designGaps({ charts: { palette, precedents, chartFiles: 2 } });
  assert.equal(g.title, 'The chart palette exists and no chart reads it');
  assert.match(g.detail, /app\/globals\.css already defines --chart-1 to --chart-5/);
  assert.match(g.fix, /var\(--chart-1\) to var\(--chart-5\)/);
});

test('a palette in use, or no chart at all, is not a gap', () => {
  const palette = { names: ['--series-1'], file: 'tokens.css', shadcnDefault: false, referenced: true };
  assert.deepEqual(designGaps({ charts: { palette, precedents, chartFiles: 2 } }), []);
  assert.deepEqual(designGaps({ charts: { palette: null, precedents: [], chartFiles: 0 } }), []);
  assert.deepEqual(designGaps({}), []);
});

// a small repo with two hand-painted charts, judged through the CLI, the
// report, the MCP context and the guard doorway
function chartyRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'roast-gaps-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'charty', dependencies: { react: '18.0.0', recharts: '2.0.0' } }));
  mkdirSync(join(dir, 'styles')); mkdirSync(join(dir, 'components')); mkdirSync(join(dir, 'pages'));
  writeFileSync(join(dir, 'styles/tokens.css'), ':root {\n  --color-brand: #3b5bdb;\n  --color-ink: #101828;\n  --color-surface: #ffffff;\n  --color-muted: #667085;\n}\n');
  writeFileSync(join(dir, 'components/Button.tsx'), "export function Button(p) { return <button className=\"btn\">{p.children}</button>; }\n");
  writeFileSync(join(dir, 'components/SalesChart.tsx'), "import { BarChart, Bar } from 'recharts';\nconst S = ['#2563eb', '#16a34a', '#f59e0b'];\nexport function SalesChart() { return <BarChart>{S.map((c) => <Bar key={c} fill={c} />)}</BarChart>; }\n");
  writeFileSync(join(dir, 'components/UsageChart.tsx'), "import { PieChart, Pie } from 'recharts';\nconst C = ['#7c3aed', '#db2777'];\nexport function UsageChart() { return <PieChart><Pie fill={C[0]} /></PieChart>; }\n");
  writeFileSync(join(dir, 'pages/a.tsx'), "import { Button } from '../components/Button';\nimport { SalesChart } from '../components/SalesChart';\nimport { UsageChart } from '../components/UsageChart';\nexport default function Page() { return <div><Button /><Button /><SalesChart /><UsageChart /></div>; }\n");
  return dir;
}

test('the gap reaches summary.json, the report, the MCP context and the guard doorway', () => {
  const dir = chartyRepo();
  const out = join(dir, 'report.html');
  const r = spawnSync(process.execPath, [BIN, dir, '--json', '--out', out, '--no-open'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const summary = JSON.parse(r.stdout);
  assert.equal(summary.gaps?.[0]?.id, 'chart-palette', JSON.stringify(summary.gaps));
  assert.deepEqual(summary.gaps[0].files.sort(), ['components/SalesChart.tsx', 'components/UsageChart.tsx']);
  assert.ok(existsSync(out));
  const html = readFileSync(out, 'utf8');
  assert.match(html, /Where agents will invent/);
  assert.match(html, /Charts have no palette/);
  const k = loadKnowledge(dir);
  assert.equal(k.gaps[0].id, 'chart-palette');
  assert.match(getContext(k), /GAP: charts have no palette\. Name the series once/);
  assert.equal(learnSystem(dir).gaps[0].id, 'chart-palette');
  rmSync(dir, { recursive: true, force: true });
});
