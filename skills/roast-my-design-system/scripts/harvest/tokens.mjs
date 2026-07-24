/**
 * Implicit-token harvest — every colour, spacing, radius, font-size the repo
 * ACTUALLY uses, with frequency counts and where. This is the heart of the
 * diagnosis ("27 greys, 19 spacing values"): we count real occurrences across
 * stylesheets, inline styles, and Tailwind utility classes.
 *
 * New in 2.0 — 1.0 only ever read a clean globals.css; this reads the mess.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------- counters ----------
class Tally {
  constructor() { this.map = new Map(); }
  add(value, file) {
    let e = this.map.get(value);
    if (!e) { e = { value, count: 0, files: new Map() }; this.map.set(value, e); }
    e.count++;
    e.files.set(file, (e.files.get(file) ?? 0) + 1);
  }
  toJSON(limitFiles = 5) {
    return [...this.map.values()]
      .sort((a, b) => b.count - a.count)
      .map((e) => ({
        value: e.value,
        count: e.count,
        files: [...e.files.entries()].sort((a, b) => b[1] - a[1]).slice(0, limitFiles)
          .map(([file, count]) => ({ file, count })),
      }));
  }
}

// ---------- colour parsing ----------
const HEX_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const FUNC_COLOR_RE = /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(\s*[^)]{1,80}\)/g;

/** normalize: lowercase; expand #abc → #aabbcc so duplicates merge. */
export function normalizeHex(hex) {
  let h = hex.toLowerCase();
  if (h.length === 4 || h.length === 5) {
    h = '#' + [...h.slice(1)].map((c) => c + c).join('');
  }
  return h;
}

/** Is this hex a grey (R≈G≈B within a small tolerance)? Diagnosis loves this. */
export function isGrey(hex) {
  const h = normalizeHex(hex);
  if (h.length < 7) return false;
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max - min <= 10;
}

// ---------- spacing / radius / font-size from CSS declarations ----------
const SPACING_PROPS = /(?:^|[^-\w])(margin(?:-(?:top|right|bottom|left))?|padding(?:-(?:top|right|bottom|left))?|gap|row-gap|column-gap|top|right|bottom|left|inset)\s*:\s*([^;{}]+)[;}]/g;
const RADIUS_PROPS = /border(?:-(?:top|bottom)-(?:left|right))?-radius\s*:\s*([^;{}]+)[;}]/g;
const FONTSIZE_PROPS = /font-size\s*:\s*([^;{}]+)[;}]/g;
const FONTFAMILY_PROPS = /font-family\s*:\s*([^;{}]+)[;}]/g;
const SHADOW_PROPS = /box-shadow\s*:\s*([^;{}]+)[;}]/g;
const LENGTH_RE = /-?\d*\.?\d+(?:px|rem|em|%|vh|vw|ch)\b/g;

// ---------- Tailwind utility classes ----------
// Colour-bearing utilities: bg-red-500, text-zinc-400, border-gray-200, arbitrary bg-[#1a1a1a]
const TW_COLOR_RE = /\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|decoration|accent|caret|shadow)-(?:\[(#[0-9a-fA-F]{3,8}|rgba?\([^\]]*\)|hsla?\([^\]]*\)|oklch\([^\]]*\))\]|((?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?))(?=[\s"'`/}:]|$)/g;
// Spacing utilities: p-4 px-2 mt-6 gap-3 space-x-2 -mx-4, arbitrary p-[13px]
const TW_SPACING_RE = /\b-?(?:[mp][trblxy]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xy])?|top|right|bottom|left)-(\[(?:[^\]]+)\]|\d+(?:\.\d+)?|px)(?=[\s"'`}:]|$)/g;
const TW_RADIUS_RE = /\brounded(?:-(?:t|b|l|r|tl|tr|bl|br))?(?:-(none|sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\]))?(?=[\s"'`}:]|$)/g;
const TW_TEXTSIZE_RE = /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|\[[^\]]+\])(?=[\s"'`}:]|$)/g;

/** Extract string contents of className=/class= attributes + template classes. */
function classStrings(src) {
  const out = [];
  for (const m of src.matchAll(/class(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g)) {
    out.push(m[1] ?? m[2] ?? m[3] ?? '');
  }
  // cva()/cn()/clsx() string args also carry classes
  for (const m of src.matchAll(/\b(?:cva|cn|clsx|classnames|twMerge)\s*\(([\s\S]{0,2000}?)\)/g)) {
    for (const s of m[1].matchAll(/["'`]([^"'`]+)["'`]/g)) out.push(s[1]);
  }
  return out;
}

// An inline style that only pipes currentcolor/inherit through (the standard
// SVG icon-inheritance pattern, often 60x in one glyph file) is not "styling
// bypassing the system" — counting it hands a sharp dev the whole rebuttal.
const TRIVIAL_INLINE_RE = /^\{?\s*(?:(?:\.\.\.[\w.]+|(?:color|fill|stroke)\s*:\s*['"]?(?:currentcolor|inherit)['"]?)\s*,?\s*)*\}?$/i;

// A style block whose values are runtime expressions (translate(\`\${x}px\`),
// width: sidebarWidth, ternaries) CANNOT be static CSS — that's dynamic
// positioning/theming, not a style crime. Only all-literal blocks count.
function isStaticInline(block) {
  const inner = block.trim().replace(/^\{/, '').replace(/\}$/, '');
  if (inner.includes('${')) return false;
  // every value must start like a literal: quote, number, negative, hex
  for (const m of inner.matchAll(/[\w-]+\s*:\s*([^,{}]+)/g)) {
    const v = m[1].trim();
    if (!/^["'0-9#-]/.test(v)) return false;
  }
  return true;
}

// Render-to-image surfaces (satori OG cards, react-pdf invoices) have inline
// styles as their ONLY styling mechanism — same honesty rule as email.
const RENDER_TO_IMAGE_RE = /ImageResponse|from ['"]satori['"]|from ['"]@react-pdf|next\/og/;

/** Extract inline style objects: style={{ ... }} */
function inlineStyleBlocks(src) {
  const out = [];
  let from = 0, idx;
  while ((idx = src.indexOf('style={{', from)) !== -1) {
    const close = src.indexOf('}}', idx);
    if (close === -1) break;
    out.push(src.slice(idx + 7, close + 1));
    from = close + 2;
  }
  return out;
}

/**
 * Harvest tokens across style files + code files.
 * Returns { colors, greys, spacing, radii, fontSizes, fontFamilies, shadows,
 *           tailwind: {...same buckets from tw classes...}, inlineStyleCount }
 */
export function harvestTokens(root, styleFiles, codeFiles) {
  const colors = new Tally(), spacing = new Tally(), radii = new Tally(),
        fontSizes = new Tally(), fontFamilies = new Tally(), shadows = new Tally();
  const twColors = new Tally(), twSpacing = new Tally(), twRadii = new Tally(), twTextSizes = new Tally();
  const twArbitrary = new Tally();
  let inlineStyleCount = 0;
  const inlineStyleFiles = new Map();

  // Colours that appear in a CSS custom-property DEFINITION (--grey-100: #f5f5f5)
  // are deliberate tokens; everything else is a hardcoded stray. The diagnosis
  // hinges on this split.
  const tokenDefined = new Set();

  const scanCssText = (text, file) => {
    for (const m of text.matchAll(/--[\w-]+\s*:\s*([^;{}]+)[;}]/g)) {
      for (const c of m[1].matchAll(HEX_RE)) tokenDefined.add(normalizeHex(c[0]));
      for (const c of m[1].matchAll(FUNC_COLOR_RE)) tokenDefined.add(c[0].replace(/\s+/g, ' ').toLowerCase());
    }
    for (const m of text.matchAll(HEX_RE)) colors.add(normalizeHex(m[0]), file);
    for (const m of text.matchAll(FUNC_COLOR_RE)) colors.add(m[0].replace(/\s+/g, ' ').toLowerCase(), file);
    for (const m of text.matchAll(SPACING_PROPS)) {
      for (const len of (m[2].match(LENGTH_RE) ?? [])) spacing.add(len, file);
    }
    for (const m of text.matchAll(RADIUS_PROPS)) radii.add(m[1].trim(), file);
    for (const m of text.matchAll(FONTSIZE_PROPS)) fontSizes.add(m[1].trim(), file);
    for (const m of text.matchAll(FONTFAMILY_PROPS)) {
      const v = m[1].trim().replace(/\s+/g, ' ');
      // var(--x) and inherit are disciplined token usage, not declarations
      if (/^(var\(--[\w-]+\)|inherit)$/i.test(v)) continue;
      fontFamilies.add(v, file);
    }
    for (const m of text.matchAll(SHADOW_PROPS)) shadows.add(m[1].trim().replace(/\s+/g, ' '), file);
  };

  for (const f of styleFiles) {
    if (/email|(^|[/.])print([/.]|$)/i.test(f)) continue;
    let text; try { text = readFileSync(join(root, f), 'utf8'); } catch { continue; }
    scanCssText(text, f);
  }

  // Email templates (and print styles) MUST inline their styling — that's
  // correct practice, not mess. Counting them would hand a sharp dev an easy
  // reason to discredit the whole report.
  const EXEMPT_RE = /email|(^|[/.])print([/.]|$)/i;
  // SVG artwork components (logos, badges, illustrated icons) carry hex that
  // is drawing, not styling — same honesty rule as email templates.
  const ARTWORK_RE = /(^|\/)[\w.-]*(icon|logo|badge|illustration|shield|artwork|graphic|background)[\w.-]*\.(tsx|jsx)$/i;
  // A component that is mostly SVG markup (theme-preview mocks, decorative
  // scenes) is drawing, not styling — regardless of its filename.
  const svgHeavy = (src) => (src.match(/<(?:svg|path|rect|circle|ellipse|polygon|mask|defs)\b/g) ?? []).length >= 15;
  // Canvas/scene renderers draw pixels; their colour literals are not UI styling.
  const RENDERER_PATH_RE = /(^|\/)(renderers?|scene|canvas)\/|renderElement|DebugCanvas/i;
  // Colour-picker palettes and design-field option lists are user-facing data.
  const PALETTE_FILE_RE = /(color-picker|colour-picker|palette|design-fields|swatch)/i;

  for (const f of codeFiles) {
    if (!/\.(tsx|jsx|ts|js)$/.test(f)) continue;
    if (EXEMPT_RE.test(f)) continue;
    let src; try { src = readFileSync(join(root, f), 'utf8'); } catch { continue; }

    // A Tailwind config's colours ARE the token layer (the tailwind-native
    // equivalent of --var definitions). Its fontFamily block is the typeface
    // declaration for the whole app.
    if (/(^|\/)tailwind\.config\.[mc]?[jt]s$/.test(f)) {
      for (const m of src.matchAll(HEX_RE)) { tokenDefined.add(normalizeHex(m[0])); colors.add(normalizeHex(m[0]), f); }
      const famBlock = src.match(/fontFamily\s*:\s*\{([\s\S]*?)\n\s*\}/);
      if (famBlock) {
        // one declaration per stack: the first non-var name; fallbacks in the
        // same array are not additional "ways" of declaring a font
        for (const arr of famBlock[1].matchAll(/\[([^\]]+)\]/g)) {
          const first = [...arr[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1])
            .find((v) => !v.startsWith('var(') && !/^--/.test(v));
          if (first) fontFamilies.add(first, f);
        }
      }
      continue;
    }
    // next/font and geist load typefaces without a font-family declaration —
    // reporting "0 typefaces" for a repo shipping .woff2 loaders is wrong.
    for (const m of src.matchAll(/import\s*\{\s*([^}]+)\}\s*from\s*["']next\/font\/google["']/g)) {
      for (const name of m[1].split(',')) { const t = name.trim().split(/\s+as\s+/)[0].trim(); if (t) fontFamilies.add(t.replace(/_/g, ' '), f); }
    }
    for (const m of src.matchAll(/localFont\s*\(\s*\{[\s\S]{0,600}?variable\s*:\s*["']--font-([\w-]+)["']/g)) {
      fontFamilies.add(m[1].replace(/-/g, ' '), f);
    }
    if (/from\s*["']geist\/font/.test(src)) fontFamilies.add('Geist', f);
    if (PALETTE_FILE_RE.test(f)) {
      for (const m of src.matchAll(HEX_RE)) tokenDefined.add(normalizeHex(m[0]));
    }
    if (ARTWORK_RE.test(f) || RENDERER_PATH_RE.test(f) || svgHeavy(src)) continue;
    const renderToImage = RENDER_TO_IMAGE_RE.test(src) || /(^|\/)api\/og\//.test(f);

    // Tailwind classes
    for (const cls of classStrings(src)) {
      for (const m of cls.matchAll(TW_COLOR_RE)) twColors.add(m[1] ? normalizeHex(m[1].startsWith('#') ? m[1] : m[1]) : m[2], f);
      for (const m of cls.matchAll(TW_SPACING_RE)) twSpacing.add(m[1], f);
      for (const m of cls.matchAll(TW_RADIUS_RE)) twRadii.add(m[1] ?? 'default', f);
      for (const m of cls.matchAll(TW_TEXTSIZE_RE)) twTextSizes.add(m[1], f);
      // Arbitrary length values (p-[13px], text-[10px], w-[257px]) — the
      // Tailwind-era way a scale erodes, one bracket at a time.
      for (const m of cls.matchAll(/[a-z][\w-]*-\[(-?\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|pt))\]/g)) twArbitrary.add(`[${m[1]}]`, f);
    }

    // Inline styles: count blocks + harvest colours/lengths inside them.
    // Dynamic blocks and render-to-image surfaces are legitimate, not counted.
    const blocks = renderToImage ? []
      : inlineStyleBlocks(src).filter((b) => !TRIVIAL_INLINE_RE.test(b.trim()) && isStaticInline(b));
    if (blocks.length) {
      inlineStyleCount += blocks.length;
      inlineStyleFiles.set(f, (inlineStyleFiles.get(f) ?? 0) + blocks.length);
      for (const b of blocks) {
        for (const m of b.matchAll(HEX_RE)) colors.add(normalizeHex(m[0]), f);
        for (const m of b.matchAll(FUNC_COLOR_RE)) colors.add(m[0].replace(/\s+/g, ' ').toLowerCase(), f);
        for (const m of b.matchAll(LENGTH_RE)) spacing.add(m[0], f);
      }
    }

    // Raw hex colours in code outside class strings (styled-components, consts)
    // — cheap approximation: any hex in a .ts/.js file counts as a colour in code.
    if (/\.(ts|js)$/.test(f)) {
      for (const m of src.matchAll(HEX_RE)) {
        // avoid counting hashes that aren't colors (e.g. IDs): require 3/4/6/8 hex digits already enforced by regex
        colors.add(normalizeHex(m[0]), f);
      }
    }
  }

  // A code file defining 15+ distinct colours is a deliberate palette
  // (drawing swatches, avatar generators, chart scales) — the MUI lesson:
  // definitions are architecture, not strays.
  const perFileDistinct = new Map();
  for (const e of colors.map.values()) {
    for (const [file] of e.files) perFileDistinct.set(file, (perFileDistinct.get(file) ?? 0) + 1);
  }
  for (const e of colors.map.values()) {
    if ([...e.files.keys()].some((f) => /\.[jt]sx?$/.test(f) && perFileDistinct.get(f) >= 15)) tokenDefined.add(e.value);
  }

  const colorList = colors.toJSON().map((c) => ({ ...c, isToken: tokenDefined.has(c.value) }));

  // Worst offenders: files carrying the most stray styling (hardcoded colours
  // that never appear in a --var definition, plus inline style blocks).
  const offenders = new Map();
  const bump = (file, key, by) => {
    const e = offenders.get(file) ?? { file, strayColors: 0, inlineBlocks: 0 };
    e[key] += by;
    offenders.set(file, e);
  };
  for (const e of colors.map.values()) {
    if (tokenDefined.has(e.value)) continue;
    for (const [file, count] of e.files) bump(file, 'strayColors', count);
  }
  for (const [file, count] of inlineStyleFiles) bump(file, 'inlineBlocks', count);
  const offenderList = [...offenders.values()]
    .map((o) => ({ ...o, total: o.strayColors + o.inlineBlocks }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return {
    colors: colorList,
    offenders: offenderList,
    greyCount: colorList.filter((c) => c.value.startsWith('#') && isGrey(c.value)).length,
    spacing: spacing.toJSON(),
    radii: radii.toJSON(),
    fontSizes: fontSizes.toJSON(),
    fontFamilies: fontFamilies.toJSON(),
    shadows: shadows.toJSON(),
    tailwind: {
      colors: twColors.toJSON(),
      spacing: twSpacing.toJSON(),
      radii: twRadii.toJSON(),
      textSizes: twTextSizes.toJSON(),
      arbitrary: twArbitrary.toJSON(),
    },
    inlineStyles: {
      count: inlineStyleCount,
      files: [...inlineStyleFiles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([file, count]) => ({ file, count })),
    },
  };
}
