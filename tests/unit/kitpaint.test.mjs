// Kit paint: what the MUI profile counts as a colour or a spacing written onto
// a component, and what it leaves alone. Every case comes from the fix loop
// on 18 MUI products (2026-09-17).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { countKitPaint } from '../../skills/roast-my-design-system/scripts/lib/kitpaint.mjs';
import { MUI } from '../../skills/roast-my-design-system/scripts/profiles/mui.mjs';

function count(files) {
  const root = mkdtempSync(join(tmpdir(), 'roast-kit-'));
  try {
    for (const [f, body] of Object.entries(files)) {
      mkdirSync(join(root, dirname(f)), { recursive: true });
      writeFileSync(join(root, f), body);
    }
    return countKitPaint(root, Object.keys(files), MUI);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const THEME = `import { createTheme } from '@mui/material/styles';
export const theme = createTheme({
  spacing: 2,
  palette: { primary: { main: '#9bf316' } },
});
`;
const card = (body) => `import Box from '@mui/material/Box';\nexport const Card = () => ${body};\n`;

test('a colour written on a component counts; the same value in the theme is marked', () => {
  const k = count({ 'src/theme.ts': THEME, 'src/Card.tsx': card(`<Box sx={{ color: '#9bf316', bgcolor: '#123456' }} />`) });
  assert.equal(k.colour.uses, 2);
  assert.equal(k.colour.samples.find((s) => s.value === '#9bf316').inTheme, true);
  assert.deepEqual(k.themeFiles, ['src/theme.ts']);
});

test('a fallback after a theme read is not paint', () => {
  const k = count({ 'src/Card.tsx': card(`<Box sx={{ color: theme.palette.common.white || '#ffffff', bgcolor: theme.palette[tone].light ?? '#fff' }} />`) });
  assert.equal(k.colour.uses, 0);
});

test('a theme folder, a chart and a map are not paint', () => {
  const k = count({
    'src/status/themes/bold/styles.ts': card(`<Box sx={{ color: '#ff0000' }} />`),
    'src/Pie.tsx': `import Box from '@mui/material/Box';\nimport { PieChart } from 'recharts';\nconst c = ['#1de9b6', '#7c4dff'];\nexport const P = () => <Box />;\n`,
    'src/Map.tsx': `import Card from '@mui/material/Card';\nimport * as maplibre from 'maplibre-gl';\nconst WATER = '#0b1422';\nexport const M = () => <Card />;\n`,
  });
  assert.equal(k.colour.uses, 0);
  assert.equal(k.exempt.length, 2);
});

test('only padding, margin and gap count as pixel spacing', () => {
  const k = count({ 'src/Card.tsx': card(`<Box sx={{ p: '13px', gap: '8px', lineHeight: '16px', fontSize: '14px', borderRadius: '999px', width: '300px', m: '1px' }} />`) });
  assert.deepEqual(k.px.samples.map((s) => s.value).sort(), ['gap: 8px', 'p: 13px']);
});

test("the theme's spacing unit is read, and a function makes it custom", () => {
  assert.equal(count({ 'src/theme.ts': THEME }).spacingUnit, '2');
  const fn = THEME.replace('spacing: 2', 'spacing: (factor) => `${factor * 0.25}rem`');
  assert.equal(count({ 'src/theme.ts': fn }).spacingUnit, 'custom');
  assert.equal(count({ 'src/theme.ts': THEME.replace('  spacing: 2,\n', '') }).spacingUnit, null);
});

test("another library's createTheme is not the MUI theme; a nested ThemeProvider is", () => {
  const k = count({
    'src/Editor.tsx': `import Box from '@mui/material/Box';\nimport { createTheme } from '@uiw/codemirror-themes';\nconst t = createTheme({ bg: '#000000' });\nexport const E = () => <Box />;\n`,
    'src/Graph.tsx': `import ThemeProvider from '@mui/system/ThemeProvider';\nexport const G = ({ children }) => <ThemeProvider theme={(outer) => ({ ...outer, palette: { primary: { main: '#555' } } })}>{children}</ThemeProvider>;\n`,
  });
  assert.deepEqual(k.themeFiles, ['src/Graph.tsx']);
  assert.equal(k.colour.samples.some((s) => s.value === '#555'), false);
});

test("each kit's advice names its own idioms, never another kit's", async () => {
  const { KITS } = await import('../../skills/roast-my-design-system/scripts/profiles/kit-common.mjs');
  await import('../../skills/roast-my-design-system/scripts/profiles/mantine.mjs');
  const m = KITS.Mantine.advice;
  const text = [m.colourHow, m.spacingHow({}), m.rulesTheme('x'), m.promptColour, m.promptSpacing, m.promptInline].join(' ');
  assert.doesNotMatch(text, /\bsx\b|MUI|theme\.palette/);
  const u = KITS.MUI.advice;
  assert.doesNotMatch([u.colourHow, u.spacingHow({}), u.promptColour].join(' '), /Mantine|--mantine/);
});

test('Mantine spacing written as a number or rem() is pixels; a theme size is not', async () => {
  const { MANTINE } = await import('../../skills/roast-my-design-system/scripts/profiles/mantine.mjs');
  const root = mkdtempSync(join(tmpdir(), 'roast-kit-'));
  try {
    writeFileSync(join(root, 'Card.tsx'), `import { Box, rem } from '@mantine/core';\nexport const C = () => <Box p={10} mt="md" gap={0} style={{ padding: rem(12) }} />;\n`);
    const k = countKitPaint(root, ['Card.tsx'], MANTINE);
    assert.deepEqual(k.px.samples.map((s) => s.value).sort(), ['p: 10px', 'padding: 12px']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a team's own layer over the kit counts as the kit", () => {
  const files = {};
  for (const n of ['Button', 'Text', 'Stack']) files[`src/app/ui/components/${n}/index.ts`] = `export { ${n} } from '@mui/material';\n`;
  for (let i = 0; i < 3; i++) files[`src/pages/Page${i}.tsx`] = `import { Button } from 'app/ui';\nexport const P = () => <Button sx={{ color: '#123456' }} />;\n`;
  const k = count(files);
  assert.deepEqual(k.layers, ['app/ui']);
  assert.equal(k.colour.uses, 3);
});

test('an array of eight or more colours is a palette, not paint', () => {
  const eight = Array.from({ length: 8 }, (_, i) => `'#10101${i}'`).join(', ');
  const k = count({ 'src/Swatches.tsx': card(`<ColorPicker swatches={[${eight}]} sx={{ color: '#999999' }} />`) });
  assert.deepEqual(k.colour.samples.map((s) => s.value), ['#999999']);
});

test('Mantine spacing below its smallest step is not counted', async () => {
  const { MANTINE } = await import('../../skills/roast-my-design-system/scripts/profiles/mantine.mjs');
  const root = mkdtempSync(join(tmpdir(), 'roast-kit-'));
  try {
    writeFileSync(join(root, 'Row.tsx'), `import { Group } from '@mantine/core';\nexport const R = () => <Group gap={4} p={16} mt={6} />;\n`);
    assert.deepEqual(countKitPaint(root, ['Row.tsx'], MANTINE).px.samples.map((s) => s.value), ['p: 16px']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a colour compared with the theme is a check, not paint', () => {
  const k = count({ 'src/Bar.tsx': card(`<Box sx={{ bgcolor: theme.bg === "#f2f3f5" ? 'grey.100' : 'grey.900', color: '#abcdef' }} />`) });
  assert.deepEqual(k.colour.samples.map((s) => s.value), ['#abcdef']);
});
