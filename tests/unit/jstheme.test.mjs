// The JavaScript theme reader (harvest/jstheme.mjs, 9.9.0): object
// literals flattened to paths, references followed, functions left unread.
import test from 'node:test';
import assert from 'node:assert/strict';
import { objectPaths, themePaths, lookupThemePath } from '../../plugin/skills/roast-my-design-system/scripts/harvest/jstheme.mjs';

const src = `
import { lighten } from 'polished';
const colors = { slate: '#9ba6b2', slateDark: '#4e5c6e' };
export const buildBaseTheme = (input) => {
  const base = 1;
  return { ...colors, accent: '#0366d6', textSecondary: colors.slateDark, faint: lighten(0.1, colors.slate), fontFamily: 'Inter', size: 4, on: true };
};
// a comment with theme.font.color.ignored: '#000000'
export const THEME_LIGHT = { font: { color: { tertiary: 'color(display-p3 0.6 0.6 0.6)', primary: \`\${x}\` } }, background: { transparent: { lighter: 'rgba(0,0,0,0.04)' } } };
`;

test('object literals anywhere in a file flatten to dotted paths, first statement wins', () => {
  const m = objectPaths(src);
  assert.equal(m.get('slate'), '#9ba6b2');
  assert.equal(m.get('accent'), '#0366d6');
  assert.equal(m.get('font.color.tertiary'), 'color(display-p3 0.6 0.6 0.6)');
  assert.equal(m.get('background.transparent.lighter'), 'rgba(0,0,0,0.04)');
  assert.ok(!m.has('font.color.ignored'), 'a comment is not a statement');
});

test('a reference is kept as one, a call or a template is null, a number or boolean is not kept', () => {
  const m = objectPaths(src);
  assert.deepEqual(m.get('textSecondary'), { ref: 'colors.slateDark' });
  assert.equal(m.get('faint'), null);
  assert.equal(m.get('font.color.primary'), null);
  assert.ok(!m.has('size') && !m.has('on'));
});

test('a function body is not read as a literal, so the object it returns is', () => {
  const m = objectPaths('export const make = () => { if (x) { return { a: "#111111" }; } return { a: "#222222" }; };');
  assert.equal(m.get('a'), '#111111');
});

test('a read resolves by its full path, then by its tail, and follows a reference', () => {
  const paths = themePaths(['t.ts'], () => src);
  assert.deepEqual(lookupThemePath(paths, 'font.color.tertiary').map((h) => h.value), ['color(display-p3 0.6 0.6 0.6)']);
  assert.deepEqual(lookupThemePath(paths, 'textSecondary').map((h) => h.value), ['#4e5c6e']);
  assert.deepEqual(lookupThemePath(paths, 'colors.slate').map((h) => h.value), ['#9ba6b2']);
  assert.deepEqual(lookupThemePath(paths, 'faint').map((h) => h.value), [null]);
  assert.equal(lookupThemePath(paths, 'nothing.here'), undefined);
});

test('every statement of a path is kept across files, an evening file last', () => {
  const files = { 'ThemeDark.ts': 'export const T = { bg: "#000000" };', 'cssVars.ts': 'export const T = { bg: "var(--t-bg)" };', 'ThemeLight.ts': 'export const T = { bg: "#ffffff" };' };
  const paths = themePaths(Object.keys(files), (f) => files[f]);
  assert.deepEqual(lookupThemePath(paths, 'bg').map((h) => h.value), ['var(--t-bg)', '#ffffff', '#000000']);
});
