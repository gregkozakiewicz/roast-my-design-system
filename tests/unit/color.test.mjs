// Colour maths, checked value by value. The golden suite only sees these
// through whole fixtures; a wrong matrix would move a score without saying why.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, isGrey, canonical, luminance } from '../../skills/roast-my-design-system/scripts/lib/color.mjs';

const near = (a, b, eps = 1.5) => Math.abs(a - b) <= eps;
const rgb = (c) => [Math.round(c.r), Math.round(c.g), Math.round(c.b)];

test('hex in every length', () => {
  assert.deepEqual(rgb(parseColor('#fff')), [255, 255, 255]);
  assert.deepEqual(rgb(parseColor('#1a2b3c')), [26, 43, 60]);
  assert.equal(parseColor('#1a2b3c80').a.toFixed(2), '0.50');
  assert.equal(parseColor('#f00a').a.toFixed(2), '0.67');
  assert.equal(parseColor('#12345'), null, 'five digits is not a colour');
});

test('rgb: legacy commas and modern slash', () => {
  assert.deepEqual(rgb(parseColor('rgb(10, 20, 30)')), [10, 20, 30]);
  assert.equal(parseColor('rgba(0,0,0,.5)').a, 0.5);
  assert.equal(parseColor('rgb(0 0 0 / 25%)').a, 0.25);
  assert.deepEqual(rgb(parseColor('rgb(100%, 0%, 50%)')), [255, 0, 128]);
});

test('hsl and the hue units', () => {
  assert.deepEqual(rgb(parseColor('hsl(0 100% 50%)')), [255, 0, 0]);
  assert.deepEqual(rgb(parseColor('hsl(120deg, 100%, 50%)')), [0, 255, 0]);
  assert.deepEqual(rgb(parseColor('hsl(0.5turn 100% 50%)')), [0, 255, 255]);
  // 100grad is 90deg; it used to be read as 100 radians ("grad" ends in "rad")
  assert.deepEqual(rgb(parseColor('hsl(100grad 100% 50%)')), rgb(parseColor('hsl(90deg 100% 50%)')));
  assert.deepEqual(rgb(parseColor('hsl(3.14159rad 100% 50%)')), rgb(parseColor('hsl(180deg 100% 50%)')));
});

test('oklch, oklab, lab, lch and color() land on the sRGB they mean', () => {
  const white = parseColor('oklch(100% 0 0)');
  assert.ok(near(white.r, 255) && near(white.g, 255) && near(white.b, 255), `oklch white: ${rgb(white)}`);
  const black = parseColor('oklab(0 0 0)');
  assert.deepEqual(rgb(black), [0, 0, 0]);
  const midLab = parseColor('lab(53.6 0 0)'); // CIELAB mid grey ≈ #808080
  assert.ok(near(midLab.r, 128, 2) && near(midLab.g, 128, 2) && near(midLab.b, 128, 2), `lab grey: ${rgb(midLab)}`);
  assert.deepEqual(rgb(parseColor('color(srgb 1 0 0)')), [255, 0, 0]);
  assert.deepEqual(rgb(parseColor('lch(100% 0 0)')), [255, 255, 255]);
  assert.equal(parseColor('color(cmyk 0 0 0 1)'), null, 'unknown space is not a colour');
});

test('references and holes are never colours', () => {
  for (const v of ['var(--x)', 'hsl(var(--primary))', 'currentColor', 'transparent', 'oklch(0.3 0.1 ${hue})', '', 'red'])
    assert.equal(parseColor(v), null, v);
});

test('grey means opaque and channels within 10', () => {
  assert.equal(isGrey('#808080'), true);
  assert.equal(isGrey('#80858a'), true);
  assert.equal(isGrey('#80858b'), false, 'a spread of 11 is a tint');
  assert.equal(isGrey('rgba(0,0,0,.12)'), false, 'an overlay is not a rung on the grey ladder');
  assert.equal(isGrey('hsl(0 0% 40%)'), true);
});

test('canonical: one identity for every spelling', () => {
  assert.equal(canonical('#111'), canonical('#111111'));
  assert.equal(canonical('#111111'), canonical('hsla(0, 0%, 6.7%, 1)'));
  assert.equal(canonical('222.2 47.4% 11.2%'), canonical('hsl(222.2 47.4% 11.2%)'), 'bare shadcn triplet');
  assert.equal(canonical('var(--x)'), null);
  assert.equal(canonical('calc(1px + 2px)'), null);
});

test('luminance orders black under white', () => {
  assert.ok(luminance(parseColor('#000')) < luminance(parseColor('#888')) && luminance(parseColor('#888')) < luminance(parseColor('#fff')));
});
