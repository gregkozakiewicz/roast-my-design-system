// The regex scanners against realistic snippets. Each case is a way a real
// stylesheet or component is written; the fixtures only cover the shapes
// somebody once put in a fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractStyling, arbitraryLengths, tripletToHsl, isTransparent, normalizeHex } from '../../skills/roast-my-design-system/scripts/harvest/tokens.mjs';
import { definedComponents, webComponentDefs, sliceObject } from '../../skills/roast-my-design-system/scripts/harvest/components.mjs';
import { extraValue, EXTRA_KINDS, BENIGN_VALUE_RE } from '../../skills/roast-my-design-system/scripts/lib/declarations.mjs';
import { typefaceOf, distinctTypefaces } from '../../skills/roast-my-design-system/scripts/lib/typefaces.mjs';

const colours = (r) => r.colors.map((c) => c.value).sort();

test('stylesheet: declared colours count, comments and id selectors do not', () => {
  const css = `/* legacy #123456 */\n#face { color: #abcdef; }\n.a, #add { background: rgb(1 2 3 / 50%); border: 1px solid #FFF; }`;
  const r = extractStyling(css, { css: true });
  assert.deepEqual(colours(r), ['#abcdef', '#ffffff', 'rgb(1 2 3 / 50%)']);
});

test('stylesheet: radius, font size, shadow and !important are found once each', () => {
  const css = `.x { border-radius: 7px; font-size: 13px; box-shadow: 0 1px 2px #000; padding: 3px !important; }`;
  const r = extractStyling(css, { css: true });
  assert.equal(r.important.length, 1);
  assert.deepEqual(r.spacing.map((s) => s.value), ['3px']);
  const radius = extraValue(EXTRA_KINDS.find((k) => k.kind === 'radius').re, css);
  assert.equal(radius, '7px');
  assert.equal(extraValue(EXTRA_KINDS.find((k) => k.kind === 'radius').re, '.y { border-radius: var(--radius, 4px); }'), null, 'a token reference with a fallback is discipline');
  assert.ok(BENIGN_VALUE_RE.test('inherit') && BENIGN_VALUE_RE.test('0') && !BENIGN_VALUE_RE.test('4px'));
});

test('jsx: class strings, style blocks, hex constants, order ids', () => {
  const jsx = `const id = "#1042"; const brand = "#6d5bff";\nexport function A() { return <div className="bg-[#1a1a1a] text-zinc-400 p-[13px] text-[10px] w-[257px] -mx-[4px]" style={{ color: '#fff', margin: '27px', opacity: .5 }} />; }`;
  const r = extractStyling(jsx, { css: false });
  assert.deepEqual(colours(r), ['#1a1a1a', '#6d5bff', '#ffffff']);
  assert.deepEqual(r.arbitrary.map((a) => a.value).sort(), ['[10px]', '[257px]'], 'spacing brackets are not arbitrary values');
  assert.deepEqual(r.spacing.map((s) => s.value).sort(), ['13px', '27px', '4px'], 'spacing brackets are off-scale spacing');
  assert.equal(r.inlineBlocks.length, 1, 'opacity: .5 is a literal');
});

test('jsx: dynamic and trivial style blocks are not static inline styles', () => {
  const dyn = extractStyling('<div style={{ width: sidebarWidth, transform: `translate(${x}px)` }} />', { css: false });
  assert.equal(dyn.inlineBlocks.length, 0);
  const trivial = extractStyling('<svg style={{ color: "currentColor" }} />', { css: false });
  assert.equal(trivial.inlineBlocks.length, 0);
});

test('arbitraryLengths: spacing utilities are left to the spacing tile', () => {
  const vals = arbitraryLengths('p-[13px] mt-[17px] -mx-[4px] gap-[3px] space-x-[2px] inset-[1px] text-[10px] rounded-[9px] w-[50%] h-[3rem] top-[5px]').map((a) => a.value);
  assert.deepEqual(vals.sort(), ['[10px]', '[3rem]', '[50%]', '[9px]']);
});

test('shadcn triplets, transparency and hex normalisation', () => {
  assert.equal(tripletToHsl('222.2 47.4% 11.2%'), 'hsl(222.2 47.4% 11.2%)');
  assert.equal(tripletToHsl('0 0% 100% / 0.5'), 'hsl(0 0% 100% / 0.5)');
  assert.equal(tripletToHsl('16px'), null);
  assert.equal(isTransparent('rgba(0,0,0,0)'), true);
  assert.equal(isTransparent('rgb(0 0 0 / 0%)'), true);
  assert.equal(isTransparent('rgba(0,0,0,.5)'), false);
  assert.equal(normalizeHex('#ABC'), '#aabbcc');
  assert.equal(normalizeHex('#ABCD'), '#aabbccdd');
});

test('definedComponents: every way a React component is declared', () => {
  const src = `
    export function Button() { return <button/>; }
    export const Card: FC<Props> = ({ a }) => <div/>;
    export const THEME = { a: 1 };
    export const items = [1, 2];
    class Login extends React.Component { render() { return <form/>; } }
    function Footer() { return <footer/>; }
    export default connect(map)(Footer);
    const Badge = () => <span/>;
    export { Badge as Chip, type Props };
  `;
  // Badge is published as Chip, so Chip is the component's name outside the file
  assert.deepEqual([...definedComponents(src)].sort(), ['Button', 'Card', 'Chip', 'Footer', 'Login']);
});

test('webComponentDefs: Stencil, Lit, customElements.define, Shoelace', () => {
  const src = `
    @Component({ tag: 'acme-button', shadow: true }) export class AcmeButton {}
    @customElement('acme-card') export class AcmeCard extends LitElement {}
    customElements.define('acme-chip', AcmeChip);
    SlDialog.define('sl-dialog');
    customElements.define('acme-chip', Again);
  `;
  assert.deepEqual(webComponentDefs(src).map((d) => `${d.tag}=${d.name}`).sort(),
    ['acme-button=AcmeButton', 'acme-card=AcmeCard', 'acme-chip=AcmeChip', 'sl-dialog=SlDialog']);
});

test('sliceObject: an escaped backslash before a quote still closes the string', () => {
  const src = 'cva("x", { variants: { a: "it\\\\", b: 2 } })';
  const r = sliceObject(src, src.indexOf('{'));
  assert.ok(r, 'object was read');
  assert.ok(r.inner.includes('b: 2'));
  assert.equal(sliceObject('const x = { a: "unterminated', 0), null);
});

test('typefaces: the face, not the fallback stack', () => {
  assert.equal(typefaceOf('"Inter", ui-sans-serif, system-ui'), 'Inter');
  assert.equal(typefaceOf('var(--font-cal), "Cal Sans", sans-serif'), 'Cal Sans');
  assert.equal(typefaceOf('inherit'), null);
  assert.deepEqual(distinctTypefaces([{ value: 'Inter, sans-serif' }, { value: '"Inter"' }, { value: 'monospace' }]), ['Inter']);
});
