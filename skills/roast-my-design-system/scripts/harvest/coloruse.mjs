/**
 * Colour use (9.7.0): what the report's Colour usage bar is sized by.
 *
 * Until 9.7.0 each segment of the bar was sized by how often its value is
 * WRITTEN, the theme file's own definitions included, so a repo's busiest
 * theme colour (bg-primary on every button) was drawn as one of its thinnest
 * segments, and the bar said nothing about how the code reaches its colours.
 * Here a segment is sized by how often the colour is USED, and every use is
 * in one of three states:
 *
 *   token     reached by name: a theme class (bg-primary, border-border), a
 *             var(--name) read, a palette class whose name the theme gave a
 *             colour of its own, or a read of the kit's theme (MUI's
 *             theme.palette, Mantine's c="dimmed"). A name whose value the
 *             scan cannot read (defined in a package, at runtime, or as a
 *             color-mix()) is still a use by name, drawn without a swatch.
 *   palette   a Tailwind palette class the one palette rule (lib/palette.mjs)
 *             does not call drift here: the rule is off, the theme has no
 *             colour of that kind, plain white and black, an @apply line.
 *   stray     a value written by hand (a token's own value pasted outside
 *             its definition included, as the live checks call it since
 *             9.1.3), or a palette class the one rule calls drift.
 *
 * A definition is not a use: the first statement of a custom property, a
 * Tailwind config's colours and a code palette file leave the bar, counted
 * exactly as the harvest counts them (harvest/tokens.mjs), so a written
 * value here is the harvest's count less its definitions.
 *
 * Which files: the same as the score. Own code and installed registries;
 * shadcn's own components, kit blocks and demo folders stay out, and so do
 * the files every check exempts (email, artwork, renderers). Where the
 * repo's own code barely uses colour yet (a fresh shadcn install), shadcn's
 * components are counted too and the result says so (scope 'installed').
 *
 * How a class finds its colour, for a use in package `pkg`: pkg's own
 * --color-NAME (Tailwind v4), then pkg's own Tailwind v3 config (or a preset
 * it reaches, read as config), then, only in a package keeping neither,
 * pkg's own --NAME (a shadcn sheet read through a config the scan did not
 * find). Then the same three across every package, where a bare --NAME is
 * read whatever the package keeps, its own sheet included: a package with
 * a theme still reads a bare --NAME when no --color-NAME and no config
 * anywhere names the class. That looser reading is the right one on the
 * fleet (teable: 1,662 of 2,721 such uses resolve to the colour they paint,
 * 2026-10-01), so it is kept on purpose and pinned by a test. The value is
 * followed through var() and hsl(var()) wrappers to a literal. Of several
 * statements of one name, the one under :root, html, :host, body or @theme
 * wins, and a statement under a dark selector or in a dark theme file
 * (app-dark.css) is read only when no other exists. A class whose name the
 * repo defines nowhere paints nothing; it is listed in deadNames, never
 * drawn. The cross-package step is a known limit: a package that imports
 * nothing from its neighbour still reads its names (formbricks' apps/web,
 * about 110 classes, 2026-10-01).
 *
 * Classes are read only where the repo shows Tailwind: a Tailwind
 * dependency, a tailwind.config.*, or a stylesheet that imports tailwindcss
 * or says @tailwind. Elsewhere text-white is Bootstrap's or a makeStyles
 * selector's (prometheus, backstage), and paints through no Tailwind theme.
 *
 * Where the theme is mostly read through code this pass cannot follow
 * (Sass or Less variables, a JavaScript theme object outside the four kits),
 * the result carries `fallback` and the report keeps the bar sized by
 * written values, saying why. That keeps the promise that this bar is never
 * less honest than the one it replaced.
 *
 * It reads; it never touches the harvest's colour list, so no score, tile or
 * count can move. The result lands beside the harvest, never inside tokens,
 * and nothing but the report reads it. It is kept out of harvestTokens on
 * purpose: the live checks build their knowledge from that, and every edit
 * hook would pay for this pass.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { readSource } from './walk.mjs';
import { isEmail, foreignStylesheet, CRASH_PAGE_RE } from '../lib/exempt.mjs';
import { canonical } from '../lib/color.mjs';
import { themePaths, lookupThemePath } from './jstheme.mjs';
import { NAMED_COLOURS } from '../lib/named-colours.mjs';
import { TAILWIND_DEFAULTS } from '../profiles/tailwind-defaults.mjs';
import { PALETTE } from '../profiles/shadcn-data.mjs';
import { blankComments, PALETTE_CLASS_RE } from './paint.mjs';
import { isDemoPath } from '../lib/demo.mjs';
import { tripletToHsl, isTransparent, normalizeHex, HEX_RE, FUNC_COLOR_RE, isVarRef, funcColour, inDeclaration, isIdentifierHex } from './tokens.mjs';
import { doorFile } from '../profiles/installed.mjs';
import { driftClasses } from '../lib/palette.mjs';
import { MUI } from '../profiles/mui.mjs';
import { MANTINE } from '../profiles/mantine.mjs';
import { CHAKRA } from '../profiles/chakra.mjs';
import { ANTD } from '../profiles/antd.mjs';

// each kit's colour reads live beside its refRe, one pattern per kit
const KIT_DEFS = Object.fromEntries([MUI, MANTINE, CHAKRA, ANTD].map((d) => [d.name, d]));

// colour utilities; side borders and ring offsets carry colours too
const UTIL = '(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|from|via|to|fill|stroke|divide|decoration|placeholder|caret|accent|shadow)';
// a variant prefix (hover:, dark:, md:) and the ! flag change nothing; the
// lookbehind lets a ':' or '!' before the utility through, so a match starts
// where the utility does (the one rule's matches are compared there)
const CLASS_RE = new RegExp(`(?<![\\w-])${UTIL}-([a-z][\\w-]*)(?:/(?:\\d+|\\[[^\\]\\s]+\\]))?(?![\\w-])`, 'g');
// arbitrary classes reading a variable: bg-[--brand] (v3), bg-(--brand) (v4),
// bg-[var(--brand)]; the utility makes it a colour read
const ARB_VAR_RE = new RegExp(`(?<![\\w-])${UTIL}-(?:\\[(?:color:)?(?:var\\(\\s*)?|\\((?:color:)?)(--[\\w-]+)`, 'g');
const VAR_RE = /var\(\s*(--[\w-]+)/g;
// a css`` tagged template, as the harvest reads it (harvest/tokens.mjs)
const CSS_BLOCK_RE = /(?:^|[\s=(,:])css\s*`([^`]*)`/gs;
const PALETTE_SHADE_RE = new RegExp(`^(?:(?:${PALETTE})-(?:50|[1-9]00|950)|white|black)$`);
const TW_CONFIG_RE = /(^|\/)tailwind\.config\.[mc]?[jt]s$/;
// a stylesheet that brings Tailwind in (v4's import, v3's directives)
const TW_SHEET_RE = /@import\s+(?:url\(\s*)?['"]tailwindcss\b|@tailwind\s+(?:base|components|utilities|variants|screens)\b/;
// A preset's colours are the config's colours: documenso keeps its brand
// scales (documenso, dawn, water, 50 to 950) in packages/tailwind-config,
// reached through presets: [baseConfig], and 63 class uses read them.
const TW_PRESET_PKG_RE = /(^|\/)[\w.@-]*tailwind-config[\w.-]*$/i;
const CODE_EXT = ['', '.js', '.cjs', '.mjs', '.ts', '/index.js', '/index.cjs', '/index.mjs', '/index.ts'];
// Tailwind's own words after a colour utility that are not colours (text-sm,
// border-solid, bg-cover), and CSS property tails a JS string can spell
// (text-align, border-radius): never a colour, never a dead name
const NOT_COLOUR = new Set(['transparent', 'current', 'inherit', 'none', 'initial', 'auto', 'color', 'style', 'width',
  'opacity', 'image', 'radius', 'collapse', 'separate', 'offset', 'size', 'clip', 'origin', 'repeat', 'position',
  'attachment', 'blend', 'xs', 'sm', 'base', 'md', 'lg', 'xl', 'left', 'center', 'right', 'justify', 'start', 'end',
  'wrap', 'nowrap', 'balance', 'pretty', 'ellipsis', 'cover', 'contain', 'fixed', 'local', 'scroll', 'top', 'bottom',
  'solid', 'dashed', 'dotted', 'double', 'hidden', 'wavy', 'inset', 'inner', 'x', 'y', 't', 'r', 'b', 'l', 's', 'e',
  'align', 'decoration', 'transform', 'overflow', 'indent', 'shadow', 'rendering', 'spacing', 'box', 'shown', 'slice',
  'clone', 'reverse', 'gradient', 'linear', 'radial', 'conic', 'font', 'decoration-color', 'underline-offset',
  'linecap', 'linejoin', 'miterlimit', 'dasharray', 'dashoffset', 'rule', 'anchor', 'rendering']);
// border-b-2, border-t-0, border-x-[3px]: a side's width, not a colour
const NOT_COLOUR_RE = /^(?:(?:gradient|linear|radial|conic|clip|origin|blend|opacity|offset|repeat|left|right|top|bottom|center|from|x|y)-|(?:\w+-)?reverse$|[trblxyse]-(?:\d|\[|px$|auto$))/;
const COLOUR_PROP_RE = /^(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?(?:-color)?|outline(?:-color)?|fill|stroke|caret-color|accent-color|text-decoration(?:-color)?|column-rule(?:-color)?|box-shadow|text-shadow|stop-color|flood-color|lighting-color)$/i;
// A statement under a dark selector or at-rule, or in a dark theme file
// (Ghost keeps its evening values under a plain :root in app-dark.css), is
// the evening value: read only when nothing else states the name
const DARK_CHAIN_RE = /(^|[^a-z])dark(?![a-z])/i;
const DARK_FILE_RE = /(^|[/._-])dark([/._-]|$)/i;
const ROOT_RE = /(^|[\s,(])(?::root|html|:host|body)\b|@theme/;
// A selector list with a bare root selector in it is a root statement
// whatever its other members say: documenso's `:root, .dark-mode-disabled`
// was ranked dark for the word in its second selector and the sheet earned
// no receipt line (9.7.1). `:root.dark` and `html[data-theme=dark]` are not
// bare, and stay dark, and so does a :root under a dark at-rule.
const bareRoot = (chain) => {
  const parts = chain.split(' > ');
  if (DARK_CHAIN_RE.test(parts.slice(0, -1).join(' > '))) return false;
  return parts[parts.length - 1].split(',').some((sel) => /^(?::root|html|:host|body)$/.test(sel.trim()));
};
// theme reads this pass cannot follow (D4): a JavaScript theme object outside
// the four kits (emotion, styled-components), and Sass or Less variables in
// a colour property. Read by the colour words a theme object uses, at any
// depth (twenty's theme.font.color.secondary, outline's theme.textSecondary,
// a library's own token.colorText), sizes and radii left out. A narrower
// pattern (theme.colors.x, theme.palette.x) missed outline, twenty and
// ant-design, whose bars then read as all strays (2026-10-01).
const JS_THEME_RE = /\b(?:props\.)?(?:theme|tokens)\.(?:\w+\.)*(?:colou?rs?|palette|background|border|gr[ae]y\d*|text|fill|accent|surface|content|fg|bg)(?:[A-Z](?!(?:adius|idth|tyle|ize|pacing|eight|amily|ransform|lign|ecoration|hadow|ottom|op|eft|ight|lock|nline)\b)\w*)?\b[\w.]*|\b(?:token|cssVar)\.color[A-Z]\w*/g;
// Not colour reads, though the pattern above takes them: MUI's mode is a
// string, getContrastText and augmentColor are functions, tonalOffset and
// contrastThreshold are numbers, and a bare theme.palette hands the whole
// object on. Azure-ipam's 39 reads were all theme.palette.mode, and sent its
// bar to the fallback for nothing (2026-10-01).
const JS_NOT_COLOUR_RE = /\.(?:mode|getContrastText|augmentColor|tonalOffset|contrastThreshold)$|(?:^|\.)palette$/;
const jsThemeReads = (text) => (text.match(JS_THEME_RE) ?? []).map((m) => m.replace(/\.+$/, '')).filter((m) => !JS_NOT_COLOUR_RE.test(m));
// a theme file: the harvest's code token sources, and any file named for a
// theme, a palette or tokens (twenty's ThemeLight.ts, outline's theme.ts,
// strapi's light-colors.ts); never a test, a story or a type file
const SKIP_THEME_FILE_RE = /(^|\/)(?:__tests__|__mocks__|stories|storybook|\.storybook|fixtures?|tests?)\/|\.(?:test|spec|stories)\.[cm]?[jt]sx?$/;
const THEME_FILE_RE = /(^|\/)[\w.-]*(?:theme|colou?rs?|palette|tokens)[\w.-]*\.[cm]?[jt]sx?$/i;
// a Sass or Less variable statement, at the start of a line: its name and
// its value up to the semicolon (a map or a multi-line value is cut at the
// first semicolon and reads as unreadable, which is right)
const SASS_DEF_RE = /(?:^|[\n;{}])\s*\$([\w-]+)\s*:\s*([^;\n]+)/g;
const LESS_DEF_RE = /(?:^|[\n;{}])\s*@([\w-]+)\s*:\s*([^;\n]+)/g;
// group 1 the property, group 2 its value
const SHEET_COLOUR_DECL_RE = /(?:^|[;{\s])(color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?|fill|stroke|box-shadow|caret-color|accent-color|text-decoration-color|column-rule-color)\s*:\s*([^;{}\n]*)/g;
// A shorthand carries widths and offsets beside its colour: in `border:
// $govuk-border-width solid $govuk-border-colour` only the second variable is
// a colour read. About 60 of govuk-frontend's 148 counted reads were widths.
const SHORTHAND_RE = /^(?:border(?:-(?:top|right|bottom|left))?|outline|box-shadow)$/i;
const LENGTH_NAME_RE = /width|size|radius|spacing|offset|spread|blur/i;
// where reads the bar cannot follow are this share of all colour uses, the
// bar keeps today's sizing by written values (2.4: 19 repos, 2026-10-01)
const UNREADABLE_SHARE = 0.2;
// fewer own uses than this and shadcn's components are counted too
const INSTALLED_MIN = 20;
const SHOWN = 60;

// the two named colours common enough in a theme file to read (--bg: white)
// every CSS colour name resolves to its hex (9.9.0; was white and black)
const NAMED = NAMED_COLOURS;
// a comma-separated list split at depth zero: "var(--a, red) 40%, white"
function splitTop(text) {
  const out = []; let depth = 0, last = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++; else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) { out.push(text.slice(last, i)); last = i + 1; }
  }
  out.push(text.slice(last));
  return out.map((x) => x.trim()).filter(Boolean);
}
// two canonical colours ("r,g,b,a%") mixed by weight in sRGB, as rgb()/rgba()
function mixCanon(a, b, pa, pb) {
  const A = a.split(',').map(Number), B = b.split(',').map(Number);
  const total = pa + pb;
  if (!total) return null;
  const wa = pa / total, wb = pb / total;
  // premultiplied, as the spec mixes: a transparent side thins the colour
  // without pulling it towards black
  const aa = (A[3] / 100) * wa, ab = (B[3] / 100) * wb;
  const alpha = aa + ab;
  if (!alpha) return 'rgba(0, 0, 0, 0)';
  const ch = (i) => Math.round((A[i] * aa + B[i] * ab) / alpha);
  return alpha >= 0.995 ? `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})` : `rgba(${ch(0)}, ${ch(1)}, ${ch(2)}, ${Math.round(alpha * 100) / 100})`;
}
const NOT_A_VALUE_RE = /^(?:transparent|currentcolor|inherit|initial|unset|none|revert|revert-layer)$/i;
// a value that is plainly one colour the scan cannot read: color-mix(),
// light-dark(), a colour function with a template in it, a Sass or Less
// variable, a CSS colour name
const OPAQUE_RE = /^(?:(?:color-mix|light-dark|rgba?|hsla?|oklch|oklab|lab|lch|color)\([\s\S]*\)|#\{[^}]*\}|\$[\w-]+|@[\w-]+|[a-z]+)$/i;
const CSS_COLOUR_WORD_RE = /^(?:red|green|blue|yellow|orange|purple|pink|gray|grey|silver|maroon|navy|teal|olive|lime|aqua|fuchsia|cyan|magenta|gold|indigo|violet|brown|crimson|tomato|coral|salmon|khaki|beige|ivory|tan|plum|orchid|lavender|turquoise|chocolate|firebrick|darkgray|darkgrey|lightgray|lightgrey|whitesmoke|gainsboro|dimgray|dimgrey|slategray|slategrey|steelblue|royalblue|dodgerblue|skyblue|seagreen|forestgreen|darkred|darkblue|darkgreen|rebeccapurple)$/i;

const UNDEF = Object.freeze({ undef: true });   // a name defined nowhere in the repo
const OPAQUE = Object.freeze({ opaque: true }); // a colour the scan cannot read

/** Statements of a comment-blanked stylesheet: custom properties and ordinary
 *  declarations, with the selector chain each sits under. */
function cssStatements(text) {
  const defs = [], decls = [];
  const stack = [];
  let last = 0;
  const flush = (a, b) => {
    const seg = text.slice(a, b);
    const m = /^\s*(--[\w-]+)\s*:\s*([\s\S]*?)\s*$/.exec(seg);
    if (m) { defs.push({ name: m[1], value: m[2], chain: stack.join(' > ') }); return; }
    const d = /^\s*([a-zA-Z-]+)\s*:\s*([\s\S]*?)\s*$/.exec(seg);
    if (d) decls.push({ prop: d[1], value: d[2], chain: stack.join(' > ') });
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') { stack.push(text.slice(last, i).trim()); last = i + 1; }
    else if (ch === '}') { flush(last, i); stack.pop(); last = i + 1; }
    else if (ch === ';') { flush(last, i); last = i + 1; }
  }
  flush(last, text.length);
  return { defs, decls };
}

/** A Tailwind v3 config's colours, flattened: primary.DEFAULT -> primary,
 *  brand[500] -> brand-500. String values only; spreads and computed values
 *  are skipped, so a palette assembled in code reads as not defined. */
export function configColours(src) {
  const out = new Map();
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
  const re = /\bcolou?rs\s*:\s*\{/g;
  let m;
  while ((m = re.exec(code))) parseObject(code, m.index + m[0].length - 1, [], out);
  return out;
}
function parseObject(s, start, path, out) {
  let i = start + 1; // s[start] === '{'
  const ws = () => { while (i < s.length && /[\s,]/.test(s[i])) i++; };
  const readString = () => { const q = s[i]; let j = i + 1; while (j < s.length && s[j] !== q) { if (s[j] === '\\') j++; j++; } const v = s.slice(i + 1, j); i = j + 1; return v; };
  const skipExpr = () => {
    let depth = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === '"' || ch === "'" || ch === '`') { readString(); continue; }
      if (ch === '{' || ch === '[' || ch === '(') depth++;
      else if (ch === '}' || ch === ']' || ch === ')') { if (depth === 0) return; depth--; }
      else if (ch === ',' && depth === 0) return;
      i++;
    }
  };
  let guard = 0;
  while (i < s.length && guard++ < 5000) {
    ws();
    if (s[i] === '}') return i + 1;
    if (s.startsWith('...', i)) { i += 3; skipExpr(); continue; }
    let key = null;
    if (s[i] === '"' || s[i] === "'") key = readString();
    else { const k = /^[\w$-]+/.exec(s.slice(i, i + 200)); if (!k) { skipExpr(); if (s[i] === '}') return i + 1; continue; } key = k[0]; i += key.length; }
    while (i < s.length && /\s/.test(s[i])) i++;
    if (s[i] !== ':') { skipExpr(); continue; }
    i += 1;
    while (i < s.length && /\s/.test(s[i])) i++;
    const next = key === 'DEFAULT' ? path : [...path, key];
    if (s[i] === '{') { i = parseObject(s, i, next, out); continue; }
    if (s[i] === '"' || s[i] === "'" || s[i] === '`') {
      const v = readString();
      const name = next.join('-');
      if (name && !out.has(name)) out.set(name, v.trim());
      continue;
    }
    // a computed value (colors.slateDarkA.slateA5, a call, a spread of a
    // scale): the name is defined, its colour is not readable here. Kept as
    // null so a class on it is the theme's, drawn without a swatch, rather
    // than a dead name or a borrowed one (react-email's apps/web, 9.9.0).
    const name = next.join('-');
    if (name && !out.has(name) && /^[\w$.[\]'"-]+/.test(s.slice(i, i + 2))) out.set(name, null);
    skipExpr();
  }
  return i;
}

/**
 * The code files a Tailwind config reaches as presets, followed a few steps:
 * presets: [require('x')], or a name bound to require('x') or imported from
 * 'x', where x is a relative path or a package of the repo's own (by its
 * package.json name, with or without a subpath). Every code file of a
 * package named like tailwind-config is a preset too. Configs themselves are
 * read as configs already and are left out.
 */
/** A workspace package's folder by its package.json name, read once:
 *  the preset reader and the stylesheet-import follower share it. */
function packageDirs(root, codeFiles, pkgOf) {
  const readJson = (p) => { try { return JSON.parse(readFileSync(join(root, p), 'utf8')); } catch { return null; } };
  let names = null;
  return (name) => {
    if (!names) {
      names = new Map();
      for (const d of new Set(codeFiles.map(pkgOf))) {
        const n = readJson(posix.join(d, 'package.json'))?.name;
        if (typeof n === 'string' && !names.has(n)) names.set(n, d);
      }
    }
    return names.get(name);
  };
}
function presetFiles(root, codeFiles, pkgOf) {
  const code = new Set(codeFiles);
  const out = new Set();
  const readJson = (p) => { try { return JSON.parse(readFileSync(join(root, p), 'utf8')); } catch { return null; } };
  const dirOf = packageDirs(root, codeFiles, pkgOf);
  const resolveSpec = (spec, from) => {
    let base;
    if (spec.startsWith('.')) base = posix.join(posix.dirname(from), spec);
    else {
      const parts = spec.split('/');
      const scoped = spec.startsWith('@');
      const dir = dirOf(parts.slice(0, scoped ? 2 : 1).join('/'));
      if (dir === undefined) return null;
      const sub = parts.slice(scoped ? 2 : 1).join('/');
      const main = sub ? null : readJson(posix.join(dir, 'package.json'))?.main;
      base = posix.join(dir, sub || (typeof main === 'string' ? main : 'index'));
    }
    for (const ext of CODE_EXT) if (code.has(base + ext)) return base + ext;
    return null;
  };
  const queue = codeFiles.filter((f) => TW_CONFIG_RE.test(f));
  const seen = new Set(queue);
  // which config reached which preset (the preset's package becomes
  // visible to the config's, see visibleFrom)
  const byConfig = new Map();
  const origin = new Map(queue.map((f) => [f, f]));
  while (queue.length) {
    const f = queue.shift();
    const src = (readSource(join(root, f)) ?? '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
    const list = /\bpresets\s*:\s*\[([^\]]*)\]/.exec(src)?.[1];
    if (!list) continue;
    const specs = [...list.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
    for (const id of list.replace(/require\([^)]*\)/g, ' ').match(/[A-Za-z_$][\w$]*/g) ?? []) {
      const bound = new RegExp(`(?:\\b(?:const|let|var)\\s+${id.replace(/\$/g, '\\$')}\\s*=\\s*require\\(\\s*['"]([^'"]+)['"]\\s*\\)|\\bimport\\s+(?:\\*\\s+as\\s+)?${id.replace(/\$/g, '\\$')}\\s+from\\s*['"]([^'"]+)['"])`).exec(src);
      if (bound) specs.push(bound[1] ?? bound[2]);
    }
    for (const spec of specs) {
      const hit = resolveSpec(spec, f);
      if (!hit || seen.has(hit)) continue;
      seen.add(hit);
      origin.set(hit, origin.get(f) ?? f);
      const cfg = origin.get(hit);
      byConfig.set(cfg, [...(byConfig.get(cfg) ?? []), hit]);
      if (!TW_CONFIG_RE.test(hit)) out.add(hit);
      queue.push(hit);
    }
  }
  for (const f of codeFiles) {
    if (/\.[mc]?[jt]s$/.test(f) && !/\.d\.[mc]?ts$/.test(f) && !TW_CONFIG_RE.test(f) && TW_PRESET_PKG_RE.test(pkgOf(f))) out.add(f);
  }
  out.byConfig = byConfig;
  return out;
}

// theme.palette.text.secondary and sx's 'text.secondary' are one name
const kitKey = (ref) => ref.replace(/^var\(\s*/, '').replace(/^(?:theme|vars|token|cssVar)\./, '').replace(/^palette\./, '')
  .replace(/^(?:c|color|bg)=/, '').replace(/['"`]/g, '');
// blank a match, keeping every other offset where it was
const blank = (text, re) => text.replace(re, (m) => ' '.repeat(m.length));
// the same for matches already found, without running the pattern again
const blankAt = (text, matches) => {
  let out = '', at = 0;
  for (const m of matches) { out += text.slice(at, m.index) + ' '.repeat(m[0].length); at = m.index + m[0].length; }
  return out + text.slice(at);
};

// A stylesheet an import names, as a repo file: relative to the importer,
// through the package's own `@/` or `~/` alias (its folder, or its src/),
// or by the package name of another workspace package (its folder, or its
// src/). A query string or a bare extension-less name is tried too.
const SHEET_EXT = ['', '.css', '.scss', '.sass', '.less', '/index.css', '/index.scss'];
function resolveSheetSpec(spec, from, { styles, pkgOf, dirOf, root }) {
  const clean = spec.replace(/[?#].*$/, '').trim();
  if (!clean || /^(?:https?:)?\/\//.test(clean) || clean === 'tailwindcss' || clean.startsWith('tailwindcss/')) return null;
  let base;
  if (clean.startsWith('.')) base = posix.join(posix.dirname(from), clean);
  else if (/^[@~]\//.test(clean)) {
    const pkgDir = pkgOf(from);
    const rest = clean.slice(2);
    for (const b of [posix.join(pkgDir || '.', rest), posix.join(pkgDir || '.', 'src', rest)]) {
      for (const ext of SHEET_EXT) { const c = posix.normalize(b + ext); if (styles.has(c)) return c; }
    }
    return null;
  } else {
    const parts = clean.split('/');
    const scoped = clean.startsWith('@');
    const dir = dirOf(parts.slice(0, scoped ? 2 : 1).join('/'));
    if (dir === undefined) return null;
    const sub = parts.slice(scoped ? 2 : 1).join('/');
    // the package's own map first: exports["."] or exports["./sub"] (a
    // string, or an object with style, import, default or require), then
    // its style or main field (rallly: "@rallly/tailwind-config" is
    // exports["."]: "./shared-styles.css")
    let pkgJson = null;
    try { pkgJson = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8')); } catch { pkgJson = null; }
    const target = (x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? x.style ?? x.import ?? x.default ?? x.require ?? null : null);
    const mapped = [];
    const exp = pkgJson?.exports;
    if (exp) {
      const key = sub ? `./${sub}` : '.';
      const hit = target(typeof exp === 'string' && !sub ? exp : exp[key]);
      if (typeof hit === 'string') mapped.push(hit);
    }
    if (!sub) for (const k of ['style', 'main']) if (typeof pkgJson?.[k] === 'string') mapped.push(pkgJson[k]);
    for (const m of mapped) { const c = posix.normalize(posix.join(dir, m)); if (styles.has(c)) return c; }
    for (const b of [posix.join(dir, sub), posix.join(dir, 'src', sub)]) {
      for (const ext of SHEET_EXT) { const c = posix.normalize(b + ext); if (styles.has(c)) return c; }
    }
    return null;
  }
  for (const ext of SHEET_EXT) { const c = posix.normalize(base + ext); if (styles.has(c)) return c; }
  return null;
}
const CSS_IMPORT_IN_CODE_RE = /\bimport\s+(?:[\w$*{}\s,]+\s+from\s+)?['"]([^'"\n]+\.(?:css|scss|sass|less)(?:\?[^'"\n]*)?)['"]|\brequire\(\s*['"]([^'"\n]+\.(?:css|scss|sass|less))['"]\s*\)/g;
const CSS_IMPORT_IN_SHEET_RE = /@import\s+(?:url\(\s*)?['"]?([^'")\s;]+)['"]?\s*\)?[^;]*;|@use\s+['"]([^'"]+)['"]/g;
// a v4 sheet pointing at a v3 config: the config's package (and the
// presets it reaches) are visible from the sheet's (react-email's apps/web)
const CSS_CONFIG_IN_SHEET_RE = /@config\s+['"]([^'"]+)['"]/g;
// a v4 sheet's @source: the folders its theme covers (dify's web sheet
// names ../../../packages/dify-ui/src, so dify-ui's files read web's theme)
const CSS_SOURCE_IN_SHEET_RE = /@source\s+(?!not\b)(?:inline\(|['"])([^'")]+)['"]?\)?/g;

/**
 * Which packages each package can see the theme of, through the
 * stylesheets it imports: the sheets its code imports, its own sheets, and
 * every sheet those reach with @import, plus the packages of the presets
 * its Tailwind config reaches. A package with no stylesheet import the scan
 * could follow is not in the map at all, and keeps the loose reading
 * (9.9.0; formbricks' apps/web imports only its own globals.css, and its
 * 50-odd shadcn class names came back in a sibling package's colours;
 * teable's app imports @teable/ui-lib's sheet with @import and keeps it).
 * @returns Map<pkg, Set<pkg>>
 */
function visibleFrom(root, files, { codeImports, sheetImports, sheetConfigs, sheetSources, presetByConfig, pkgOf, dirOf }) {
  const styles = new Set(files.styles ?? []);
  const ctx = { styles, pkgOf, dirOf, root };
  const code = new Set(files.code ?? []);
  // the config a sheet names, as a repo file
  const configOf = (f) => {
    const out = [];
    for (const spec of sheetConfigs.get(f) ?? []) {
      const base = posix.normalize(posix.join(posix.dirname(f), spec));
      for (const ext of ['', '.js', '.cjs', '.mjs', '.ts']) if (code.has(base + ext)) { out.push(base + ext); break; }
    }
    return out;
  };
  const resolved = new Map(); // sheet -> [sheet] it imports
  const sheetOf = (f) => {
    if (resolved.has(f)) return resolved.get(f);
    const out = [];
    resolved.set(f, out);
    for (const spec of sheetImports.get(f) ?? []) { const hit = resolveSheetSpec(spec, f, ctx); if (hit) out.push(hit); }
    return out;
  };
  const entries = new Map(); // pkg -> Set<sheet>
  const add = (pkg, sheet) => { if (!entries.has(pkg)) entries.set(pkg, new Set()); entries.get(pkg).add(sheet); };
  const wired = new Set();
  for (const [f, specs] of codeImports) {
    for (const spec of specs) { const hit = resolveSheetSpec(spec, f, ctx); if (hit) { add(pkgOf(f), hit); wired.add(pkgOf(f)); } }
  }
  for (const f of styles) {
    add(pkgOf(f), f);
    if (sheetOf(f).length || configOf(f).length) wired.add(pkgOf(f));
  }
  const out = new Map();
  for (const pkg of wired) {
    const seen = new Set(), queue = [...(entries.get(pkg) ?? [])];
    const vis = new Set([pkg]);
    const configs = new Set();
    while (queue.length) {
      const f = queue.shift();
      if (seen.has(f)) continue;
      seen.add(f);
      vis.add(pkgOf(f));
      queue.push(...sheetOf(f));
      for (const c of configOf(f)) configs.add(c);
    }
    // the presets its own configs reach, and the configs its sheets name
    for (const [cfg, presets] of presetByConfig) if (pkgOf(cfg) === pkg || configs.has(cfg)) for (const p of presets) vis.add(pkgOf(p));
    for (const c of configs) vis.add(pkgOf(c));
    out.set(pkg, vis);
  }
  // a sheet that covers another package's folder with @source lends that
  // package everything the sheet's own package can see
  for (const [f, specs] of sheetSources) {
    const owner = pkgOf(f);
    const lends = out.get(owner) ?? new Set([owner]);
    for (const spec of specs) {
      const dir = posix.normalize(posix.join(posix.dirname(f), spec.replace(/\/\*\*?.*$/, '').replace(/\/$/, '')));
      for (const [pkg, vis] of out) {
        if (pkg === owner) continue;
        const under = pkg === '' ? dir === '.' : (dir === pkg || dir.startsWith(`${pkg}/`) || pkg.startsWith(`${dir}/`));
        if (under) for (const p of lends) vis.add(p);
      }
    }
  }
  return out;
}

/**
 * @param root     repo root
 * @param files    the walk's files, as the harvest scoped them
 * @param tokens   the harvest's tokens (colors, tokenSources)
 * @param opts.P   profileOf(profile): which files are shadcn's own
 * @param opts.palette  profile.palette, the one rule's vocabulary (null: off)
 * @param opts.kit      the kit's name (MUI, Mantine, Chakra, Ant Design) or null
 * @param opts.tailwind a Tailwind dependency; a tailwind.config.* or a
 *                      stylesheet bringing Tailwind in counts as well, and
 *                      without any of the three no class is read
 * @param opts.retuned  palette names the repo's own theme gave its own colour
 *                      (profile.palette.retuned; in utility-class mode, where
 *                      the rule is off, the shadcn profile's own theme's)
 */
export function colourUse(root, files, tokens, { email = null, P = null, palette = null, kit = null, tailwind = true, retuned: retunedNames = null } = {}) {
  const t0 = Date.now();
  const kitName = typeof kit === 'string' ? kit : kit?.name ?? null;
  const kitRe = kitName ? KIT_DEFS[kitName]?.colourRefRe ?? null : null;
  const isDoor = (f) => !!P?.isShadcn && doorFile(P, f);

  const pkgCache = new Map();
  const pkgOf = (file) => {
    let dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';
    const seen = [];
    for (;;) {
      if (pkgCache.has(dir)) break;
      seen.push(dir);
      if (existsSync(join(root, dir, 'package.json'))) { pkgCache.set(dir, dir); break; }
      if (!dir) { pkgCache.set('', ''); break; }
      dir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
    }
    const owner = pkgCache.get(dir);
    for (const d of seen) pkgCache.set(d, owner);
    return owner;
  };

  // ---------- 1. definitions: every statement of every name ----------
  const defs = new Map();            // --name -> [{ pkg, value, rank, order }]
  const themePkgs = new Set();       // packages stating --color-* (a v4 theme)
  const defWrites = new Map();       // canonical -> the harvest's writes that sit in definitions
  const defWritesIn = new Map();     // canonical + file -> the same, file by file
  const addDefWrite = (canon, file) => {
    if (!canon) return;
    defWrites.set(canon, (defWrites.get(canon) ?? 0) + 1);
    const k = `${canon}\u0000${file}`;
    defWritesIn.set(k, (defWritesIn.get(k) ?? 0) + 1);
  };
  // The harvest's first-statement rule, line for line (harvest/tokens.mjs
  // scanCssText): a later statement of a name holding a readable colour is a
  // variant and was never counted; every other colour inside a custom
  // property statement was, and is a definition.
  const firstSeen = new Set();
  const countDefinitionWrites = (raw, pkg, file) => {
    const text = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
      .replace(/var\(\s*--[\w-]+\s*,([^()]*)\)/g, (m, fb) => m.replace(fb, ' '.repeat(fb.length)));
    // a custom property, or (9.9.0) a Sass or Less variable or a Sass map
    // entry ("red": #d4351c): the hex it states is a definition, not a write
    const sass = /\.(scss|sass|less)$/i.test(file);
    const defRe = sass ? /(?:--|\$|@)([\w-]+)\s*:\s*([^;{}]+)[;}]|"([\w-]+)"\s*:\s*(#[0-9a-f]{3,8}|(?:rgba?|hsla?|oklch)\([^)]*\))/gi : /--([\w-]+)\s*:\s*([^;{}]+)[;}]/g;
    for (const m of text.matchAll(defRe)) {
      if (m[3] !== undefined) { addDefWrite(canonical(m[4]), file); continue; }
      const key = `${pkg}\u0000${m[1]}`;
      const variant = firstSeen.has(key);
      if (!variant) firstSeen.add(key);
      if (variant && canonical(m[2]) !== null) continue;
      const at = m.index + m[0].lastIndexOf(m[2]);
      for (const h of m[2].matchAll(HEX_RE)) if (inDeclaration(text, at + h.index)) addDefWrite(canonical(normalizeHex(h[0])), file);
      for (const c of m[2].matchAll(FUNC_COLOR_RE)) {
        const v = isVarRef(c[0]) ? null : funcColour(c[0]);
        if (v && !isTransparent(v)) addDefWrite(canonical(v), file);
      }
      if (!variant) { const trip = tripletToHsl(m[2]); if (trip) addDefWrite(canonical(trip), file); }
    }
  };
  let order = 0;
  const addStatements = (st, f, pkg) => {
    const fileDark = DARK_FILE_RE.test(f);
    for (const d of st.defs) {
      const rank = fileDark ? 2 : bareRoot(d.chain) ? 0 : DARK_CHAIN_RE.test(d.chain) ? 2 : ROOT_RE.test(d.chain) ? 0 : 1;
      const list = defs.get(d.name) ?? [];
      list.push({ pkg, value: d.value, rank, order: order++ });
      defs.set(d.name, list);
      if (d.name.startsWith('--color-')) themePkgs.add(pkg);
    }
  };
  const sheets = [];
  // Tailwind's evidence: the dependency, a config, or a stylesheet bringing
  // it in (plausible-analytics reads as plain CSS yet imports tailwindcss)
  let tw = !!tailwind || (files.code ?? []).some((f) => TW_CONFIG_RE.test(f));
  // what imports what, for the theme a package can see (visibleFrom)
  const codeImports = new Map(), sheetImports = new Map(), sheetConfigs = new Map(), sheetSources = new Map();
  const preDefs = new Map(); // Sass/Less variable -> [{ pkg, value, order, dflt }]
  let preOrder = 0;
  for (const f of files.styles ?? []) {
    const raw = readSource(join(root, f));
    if (raw === null || isEmail(f, raw, email) || foreignStylesheet(f, raw)) continue;
    const pkg = pkgOf(f);
    countDefinitionWrites(raw, pkg, f);
    const text = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
    if (text.includes('@import') || text.includes('@use')) sheetImports.set(f, [...text.matchAll(CSS_IMPORT_IN_SHEET_RE)].map((m) => m[1] ?? m[2]));
    if (text.includes('@config')) sheetConfigs.set(f, [...text.matchAll(CSS_CONFIG_IN_SHEET_RE)].map((m) => m[1]));
    // Sass and Less variables defined here: $brand: #1d70b8; @brand: #1d70b8;
    // (9.9.0; until now every read of one was a theme the bar could not follow)
    if (/\.(scss|sass|less)$/i.test(f)) {
      const less = /\.less$/i.test(f);
      for (const m of text.matchAll(less ? LESS_DEF_RE : SASS_DEF_RE)) {
        const name = (less ? '@' : '$') + m[1];
        const list = preDefs.get(name) ?? [];
        list.push({ pkg, value: m[2].trim(), order: preOrder++, dflt: /!default\s*$/.test(m[2]) });
        preDefs.set(name, list);
      }
    }
    if (text.includes('@source')) { const src = [...text.matchAll(CSS_SOURCE_IN_SHEET_RE)].map((m) => m[1]).filter((x) => /^\.{1,2}\//.test(x)); if (src.length) sheetSources.set(f, src); }
    if (!tw && TW_SHEET_RE.test(text)) tw = true;
    const st = cssStatements(text);
    addStatements(st, f, pkg);
    sheets.push({ f, pkg, st, text });
  }
  // What a code file uses, read once while the file is open and kept as
  // small records (never the file's text), resolved once every definition is
  // known. The kit's reads and the theme reads the bar cannot follow are
  // taken from the whole file, css`` interpolations included (antd-style
  // writes ${token.colorText} inside them); classes and var() reads from the
  // file without its css`` blocks, whose var() reads count as a stylesheet's.
  const utilStart = (m) => m.index + /^(?:[\w-]+:)*/.exec(m[0])[0].length;
  const extractUses = (f, pkg, raw, hasBlocks, door) => {
    // comments blanked once; the css`` blocks are then blanked out of a copy
    // (offsets kept), never a second pass over the file
    let whole = blankComments(raw);
    const kitRefs = [];
    if (kitRe) {
      const hits = [...whole.matchAll(kitRe)];
      for (const m of hits) kitRefs.push(m[0]);
      if (hits.length) whole = blankAt(whole, hits);
    }
    let code = hasBlocks ? blank(whole, CSS_BLOCK_RE) : whole;
    const js = whole.includes('theme.') || whole.includes('token') || whole.includes('cssVar.') ? jsThemeReads(whole) : [];
    const arbVars = [];
    if (tw && code.includes('--') && /-[[(](?:color:)?(?:var\(\s*)?--/.test(code)) {
      for (const m of code.matchAll(ARB_VAR_RE)) arbVars.push(m[1]);
      code = blank(code, ARB_VAR_RE);
    }
    const vars = code.includes('var(') ? [...code.matchAll(VAR_RE)].map((m) => m[1]) : [];
    // a class is Tailwind's only where the repo shows Tailwind
    const found = tw ? [...code.matchAll(CLASS_RE)] : [];
    let drift = null, ruled = null;
    // the one rule's pattern runs only where a palette class is in sight;
    // inside shadcn's own components it judges nothing
    if (!door && palette && found.some((m) => PALETTE_SHADE_RE.test(m[1]))) {
      const hits = [...code.matchAll(PALETTE_CLASS_RE)];
      ruled = new Set(hits.map(utilStart));
      drift = new Set(driftClasses(code, palette, hits).map(utilStart));
    }
    // plain records: a match array would keep the whole file alive
    const classes = found.map((m) => ({ rest: m[1], index: m.index, full: m[0] }));
    return { f, pkg, door, kitRefs, js, arbVars, vars, classes, drift, ruled };
  };

  // Code files, in the harvest's order: css`` blocks are stylesheets (Lit,
  // styled-components), Tailwind configs and code palette files define
  const tokenSources = new Set(tokens.tokenSources ?? []);
  // the code files the harvest skipped (an email, a crash page, an exempt
  // file), read from its own list rather than judged again; a widget
  // stylesheet's entry carries a count and is not one of them
  const skipped = new Set((tokens.exemptFiles ?? []).filter((e) => e.count === undefined).map((e) => e.file));
  const config = new Map();          // config colour name -> [{ pkg, value }]
  const configPkgs = new Set();
  const readConfig = (src, pkg) => {
    for (const [name, value] of configColours(src)) {
      const list = config.get(name) ?? [];
      list.push({ pkg, value });
      config.set(name, list);
      // a config of computed values alone does not make the package one
      // with a readable config (the bare --NAME rule still applies there)
      if (value !== null) configPkgs.add(pkg);
    }
  };
  // presets a config reaches, read as config (documenso's brand scales)
  const presets = presetFiles(root, files.code ?? [], pkgOf);
  const codeFiles = [];
  for (const f of files.code ?? []) {
    if (!/\.(tsx|jsx|ts|js)$/.test(f)) continue;
    const flagged = skipped.has(f);
    if (flagged && CRASH_PAGE_RE.test(f)) continue;
    const raw = readSource(join(root, f));
    if (raw === null || (flagged && isEmail(f, raw, email))) continue;
    const pkg = pkgOf(f);
    if (/\.(?:css|scss|sass|less)['"]/.test(raw)) {
      const specs = [...raw.matchAll(CSS_IMPORT_IN_CODE_RE)].map((m) => m[1] ?? m[2]);
      if (specs.length) codeImports.set(f, specs);
    }
    let src = raw;
    const blocks = [];
    if (raw.includes('css')) for (const m of raw.matchAll(CSS_BLOCK_RE)) {
      const text = m[1].replace(/\$\{[^}]*\}/g, ' ');
      if (text.length < 20) continue;
      countDefinitionWrites(text, pkg, f);
      const blanked = text.replace(/\/\*[\s\S]*?\*\//g, (x) => ' '.repeat(x.length));
      const st = cssStatements(blanked);
      addStatements(st, f, pkg);
      blocks.push({ f, pkg, st, text: blanked, inCode: true });
    }
    if (blocks.length) src = raw.replace(CSS_BLOCK_RE, ' ');
    // A code file among the harvest's token sources with no css`` block is a
    // palette or theme file (theme.ts, a colour picker's swatches): it
    // defines, so its reads are not uses. One with a block is a component's
    // styles (Lit, styled-components) that also defines a property or two:
    // its reads count like any stylesheet's.
    const isConfig = TW_CONFIG_RE.test(f);
    const isPreset = !isConfig && presets.has(f);
    const exempt = !isConfig && !isPreset && flagged;
    const paletteFile = tokenSources.has(f) && !blocks.length;
    if (!isConfig && !isPreset && !exempt) sheets.push(...blocks);
    if (isConfig) {
      // the harvest counts every hex in a config as a definition
      for (const h of src.matchAll(HEX_RE)) addDefWrite(canonical(normalizeHex(h[0])), f);
      readConfig(src, pkg);
      continue;
    }
    if (isPreset) {
      // a preset defines too: the loose hex the harvest counted there
      if (!flagged && /\.(ts|js)$/.test(f)) for (const h of src.matchAll(HEX_RE)) if (!isIdentifierHex(h[0])) addDefWrite(canonical(normalizeHex(h[0])), f);
      readConfig(src, pkg);
      continue;
    }
    if (exempt) continue;
    // a code palette file defines: the loose hex the harvest counted there
    if (paletteFile) {
      if (/\.(ts|js)$/.test(f)) for (const h of src.matchAll(HEX_RE)) if (!isIdentifierHex(h[0])) addDefWrite(canonical(normalizeHex(h[0])), f);
      continue;
    }
    if (isDemoPath(f)) continue;
    codeFiles.push(extractUses(f, pkg, raw, blocks.length > 0, isDoor(f)));
  }
  // .mjs and .cjs configs and presets: their names, never their hex (the
  // harvest reads no .mjs)
  for (const f of files.code ?? []) {
    if (!/\.[mc]js$/.test(f) || !(TW_CONFIG_RE.test(f) || presets.has(f))) continue;
    const src = readSource(join(root, f));
    if (src === null) continue;
    readConfig(src, pkgOf(f));
  }

  // ---------- 2. names to colours ----------
  // the statement a use in `pkg` reads: its own package first, then any;
  // :root and @theme before other selectors, evening last, first stated first
  const best = (xs) => xs.reduce((a, b) => ((a.rank - b.rank || a.order - b.order) <= 0 ? a : b));
  const pick = (list, pkg) => {
    if (!list?.length) return null;
    const own = list.filter((x) => x.pkg === pkg);
    return best(own.length ? own : list);
  };
  const nameCache = new Map();
  // -> { canon, literal } | UNDEF | OPAQUE | null (not a colour)
  const resolveValue = (value, pkg, depth = 0) => {
    if (value === undefined || value === null || depth > 8) return null;
    const v = String(value).trim().replace(/\s*!important$/i, '');
    if (!v || NOT_A_VALUE_RE.test(v)) return null;
    if (NAMED[v.toLowerCase()]) return { canon: canonical(NAMED[v.toLowerCase()]), literal: NAMED[v.toLowerCase()] };
    const direct = canonical(v);
    if (direct) return { canon: direct, literal: tripletToHsl(v) ?? v };
    // channels kept for rgba(var(--x-rgb), 0.5): Mattermost's 61, 60, 64
    const comma = /^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/.exec(v);
    if (comma && [comma[1], comma[2], comma[3]].every((x) => Number(x) <= 255)) {
      const lit = `rgb(${comma[1]}, ${comma[2]}, ${comma[3]})`;
      return { canon: canonical(lit), literal: lit };
    }
    let m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/.exec(v);
    if (m) {
      const r = resolveName(m[1], pkg, depth + 1);
      if (r === UNDEF && m[2]) return resolveValue(m[2], pkg, depth + 1) ?? UNDEF;
      return r;
    }
    // hsl(var(--x)), rgb(var(--x) / <alpha-value>), oklch(var(--x) / 0.5)
    m = /^(hsla?|rgba?|oklch|oklab|lab|lch)\(\s*var\(\s*(--[\w-]+)\s*(?:,[^()]*)?\)\s*(?:[,/]\s*[^)]*)?\)$/.exec(v);
    if (m) {
      const inner = lookupLiteral(m[2], pkg, depth + 1);
      if (inner === UNDEF) return UNDEF;
      if (!inner) return OPAQUE;
      const wrapped = `${m[1].replace(/a$/, '')}(${inner})`;
      const w = canonical(wrapped);
      if (w) return { canon: w, literal: wrapped };
      const c = canonical(inner);
      return c ? { canon: c, literal: tripletToHsl(inner) ?? inner } : OPAQUE;
    }
    // color-mix(in <space>, A p%, B q%): both sides resolved the same way,
    // then mixed in sRGB (9.9.0). The spec mixes in the named space; for the
    // mixes a theme writes (a brand with white, black or transparent) the
    // sRGB result sits within the twin threshold of the real one, and a
    // swatch that is nearly right beats an opaque cell. light-dark(a, b)
    // is its daylight side.
    m = /^color-mix\(\s*in\s+[\w-]+(?:\s+(?:shorter|longer|increasing|decreasing)\s+hue)?\s*,\s*([\s\S]+)\)$/i.exec(v);
    if (m) {
      const sides = splitTop(m[1]);
      if (sides.length === 2) {
        const side = (t) => { const pm = /^([\s\S]*?)\s*(\d+(?:\.\d+)?)%$/.exec(t.trim()); return { colour: (pm ? pm[1] : t).trim(), pct: pm ? Number(pm[2]) : null }; };
        const a = side(sides[0]), b = side(sides[1]);
        let pa = a.pct, pb = b.pct;
        if (pa === null && pb === null) { pa = 50; pb = 50; } else if (pa === null) pa = 100 - pb; else if (pb === null) pb = 100 - pa;
        // transparent is a colour in a mix: it thins the other side
        const clear = { canon: '0,0,0,0', literal: 'transparent' };
        const resolveSide = (c) => (/^transparent$/i.test(c) ? clear : resolveValue(c, pkg, depth + 1));
        const ra = resolveSide(a.colour), rb = resolveSide(b.colour);
        if (ra === UNDEF || rb === UNDEF) return UNDEF;
        const mixed = ra?.canon && rb?.canon ? mixCanon(ra.canon, rb.canon, pa, pb) : null;
        if (mixed) return { canon: canonical(mixed), literal: mixed };
        return OPAQUE;
      }
    }
    m = /^light-dark\(\s*([\s\S]+)\)$/i.exec(v);
    if (m) { const sides = splitTop(m[1]); if (sides.length === 2) return resolveValue(sides[0], pkg, depth + 1); }
    if (OPAQUE_RE.test(v) && (!/^[a-z]+$/i.test(v) || CSS_COLOUR_WORD_RE.test(v))) return OPAQUE;
    return null;
  };
  // the raw literal behind a name (a bare triplet stays bare, for a wrapper)
  const lookupLiteral = (name, pkg, depth) => {
    if (depth > 8) return null;
    const d = pick(defs.get(name), pkg);
    if (!d) { const pal = /^--color-(.+)$/.exec(name); return pal && TAILWIND_DEFAULTS[pal[1]] ? TAILWIND_DEFAULTS[pal[1]] : UNDEF; }
    const v = d.value.trim();
    const m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/.exec(v);
    if (m) { const r = lookupLiteral(m[1], d.pkg, depth + 1); return r === UNDEF && m[2] ? m[2].trim() : r; }
    return v;
  };
  const resolveName = (name, pkg, depth = 0) => {
    const key = `${pkg}\u0000${name}`;
    if (nameCache.has(key)) return nameCache.get(key);
    nameCache.set(key, null); // cycle guard
    const d = pick(defs.get(name), pkg);
    let r;
    if (d) r = resolveValue(d.value, d.pkg, depth);
    else {
      // Tailwind's own palette answers --color-x when nothing restates it
      const pal = /^--color-(.+)$/.exec(name);
      r = pal && TAILWIND_DEFAULTS[pal[1]] ? resolveValue(TAILWIND_DEFAULTS[pal[1]], pkg, depth) : UNDEF;
    }
    nameCache.set(key, r);
    return r;
  };
  const isLiteral = (r) => !!r && !!r.canon;

  // ---------- 3. classes: a theme name, a palette shade, or nothing ----------
  const classCache = new Map();
  // the packages each package can see the theme of (null: not wired, so any)
  const visible = visibleFrom(root, files, { codeImports, sheetImports, sheetConfigs, sheetSources, presetByConfig: presets.byConfig ?? new Map(), pkgOf, dirOf: packageDirs(root, [...(files.code ?? []), ...(files.styles ?? [])], pkgOf) });
  // a theme lookup in one package (or any, pkg null, or a set of packages):
  // the plan's order
  const lookupIn = (rest, pkg) => {
    const set = pkg instanceof Set ? pkg : null;
    const inPkg = (list) => (pkg === null ? list : set ? list?.filter((x) => set.has(x.pkg)) : list?.filter((x) => x.pkg === pkg));
    const colorDefs = inPkg(defs.get(`--color-${rest}`));
    if (colorDefs?.length) return { name: `--color-${rest}`, r: resolveValue(best(colorDefs).value, best(colorDefs).pkg) };
    const cfg = inPkg(config.get(rest));
    if (cfg?.length) {
      // a readable value first; a computed one is the theme's, unread
      const lit = cfg.find((x) => x.value !== null);
      return { name: rest, r: lit ? resolveValue(lit.value, lit.pkg) : OPAQUE };
    }
    // a bare --NAME (a shadcn sheet read through a config the scan did not
    // find): only in a package keeping no @theme and no readable config
    if (pkg === null || set || (!themePkgs.has(pkg) && !configPkgs.has(pkg))) {
      const bare = inPkg(defs.get(`--${rest}`));
      if (bare?.length) {
        const r = resolveValue(best(bare).value, best(bare).pkg);
        if (r) return { name: `--${rest}`, r };
      }
    }
    return null;
  };
  // -> { kind: 'theme', canon?, literal?, name, outside? } | { kind: 'palette', shade } | { kind: 'dead' } | null
  const classTarget = (rest, pkg) => {
    const key = `${pkg}\u0000${rest}`;
    if (classCache.has(key)) return classCache.get(key);
    let r = null;
    if (NOT_COLOUR.has(rest) || NOT_COLOUR_RE.test(rest)) r = null;
    else if (PALETTE_SHADE_RE.test(rest)) r = { kind: 'palette', shade: rest };
    else {
      const hit = lookupIn(rest, pkg) ?? lookupIn(rest, visible.get(pkg) ?? null);
      if (!hit || hit.r === null) r = hit ? null : { kind: 'dead' };
      else if (isLiteral(hit.r)) r = { kind: 'theme', canon: hit.r.canon, literal: hit.r.literal, name: hit.name };
      else r = { kind: 'theme', outside: true, name: hit.name };
    }
    classCache.set(key, r);
    return r;
  };
  // a palette shade's colour: the repo's own where it restates the name
  const shadeCache = new Map();
  const shadeColour = (shade, pkg) => {
    const key = `${pkg}\u0000${shade}`;
    if (shadeCache.has(key)) return shadeCache.get(key);
    let r = defs.has(`--color-${shade}`) ? resolveName(`--color-${shade}`, pkg) : null;
    if (!isLiteral(r)) r = resolveValue(TAILWIND_DEFAULTS[shade], pkg);
    shadeCache.set(key, r);
    return r;
  };
  // In utility-class mode the rule is off, yet a theme of the repo's own can
  // still give palette names its own colours (rybbit retunes all eleven
  // neutrals): those classes reach the theme by name
  const retuned = new Set(retunedNames ?? palette?.retuned ?? []);

  // ---------- 4. count ----------
  const seg = new Map();
  const segOf = (key, init) => {
    let s = seg.get(key);
    if (!s) { s = { classes: 0, vars: 0, kit: 0, palette: 0, written: 0, names: new Map(), files: new Map(), value: null, canon: null, named: null, ...init }; seg.set(key, s); }
    return s;
  };
  const note = (s, name, file) => {
    if (name) s.names.set(name, (s.names.get(name) ?? 0) + 1);
    if (file) s.files.set(file, (s.files.get(file) ?? 0) + 1);
  };
  const totals = { classes: 0, vars: 0, kit: 0, outside: 0, palette: 0, paletteStray: 0, paletteStrayDark: 0, written: 0, writtenTokenValue: 0, total: 0 };
  // white and black apart: Ghost retunes black and keeps white as the palette's
  const why = { off: 0, family: 0, white: 0, black: 0, apply: 0, sides: 0, installed: 0 };
  const sidesSample = new Map();
  const dead = new Map();
  const unreadable = { sass: 0, less: 0, js: 0 };
  // reads of a Sass or Less variable or a JavaScript theme value the repo
  // defines, counted by name above (9.9.0); the fold says so
  const readBy = { sass: 0, less: 0, js: 0 };

  const tokenUse = (target, how, file) => {
    if (target.canon) {
      const s = segOf(`t|${target.canon}`, { canon: target.canon, value: target.literal, state: 'token' });
      s[how] += 1; note(s, target.name, file);
      totals[how] += 1;
    } else {
      // one cell per name, drawn without a swatch, so the theme's own words show
      const s = segOf(`o|${target.name}`, { state: 'token', named: 'outside' });
      s[how] += 1; note(s, target.name, file);
      totals.outside += 1;
    }
  };
  // `dark`: white or black written as a dark: override on a shadcn theme,
  // which the one rule flags for a reason of its own (DARK_WB_RE), so it is
  // its own segment with its own words
  const paletteUse = (shade, pkg, file, stray, dark = false) => {
    const c = shadeColour(shade, pkg);
    const s = segOf(`${stray ? (dark ? 'pd' : 'ps') : 'p'}|${shade}`, { canon: c?.canon ?? null, value: c?.literal ?? TAILWIND_DEFAULTS[shade], state: stray ? 'stray' : 'palette', ...(dark ? { dark: true } : {}) });
    s.palette += 1; note(s, shade, file);
    totals[stray ? 'paletteStray' : 'palette'] += 1;
    if (dark) totals.paletteStrayDark += 1;
  };
  const varUse = (name, file, pkg, colourCtx) => {
    const r = resolveName(name, pkg);
    if (isLiteral(r)) { tokenUse({ ...r, name }, 'vars', file); return; }
    if (r === OPAQUE || (r === UNDEF && (colourCtx || name.startsWith('--color-')))) tokenUse({ name }, 'vars', file);
  };
  // the classes found: `drift` holds where the one rule flags a palette
  // class (its utility's offset), `ruled` where its pattern matched at all
  const classUses = (matches, file, pkg, { apply = false, installed = false, drift = null, ruled = null } = {}) => {
    for (const m of matches) {
      const t = classTarget(m.rest, pkg);
      if (!t) continue;
      if (t.kind === 'dead') { dead.set(m.rest, (dead.get(m.rest) ?? 0) + 1); continue; }
      if (t.kind === 'theme') { tokenUse(t, 'classes', file); continue; }
      const shade = t.shade;
      // a palette name the theme gave its own colour is the theme
      if (retuned.has(shade)) {
        const c = shadeColour(shade, pkg);
        if (isLiteral(c)) { tokenUse({ ...c, name: shade }, 'classes', file); continue; }
      }
      // the rule's palette pattern needs a shade, so a flagged white or black
      // is a dark: override (DARK_WB_RE)
      if (!apply && !installed && drift?.has(m.index)) { paletteUse(shade, pkg, file, true, shade === 'white' || shade === 'black'); continue; }
      paletteUse(shade, pkg, file, false);
      if (installed) why.installed += 1;
      else if (apply) why.apply += 1;
      else if (!palette) why.off += 1;
      else if (shade === 'white' || shade === 'black') why[shade] += 1;
      else if (ruled?.has(m.index)) why.family += 1;
      else { why.sides += 1; const cls = m.full.replace(/\/.*$/, ''); sidesSample.set(cls, (sidesSample.get(cls) ?? 0) + 1); }
    }
  };
  const records = (text) => [...text.matchAll(CLASS_RE)].map((m) => ({ rest: m[1], index: m.index, full: m[0] }));

  // stylesheets (and css`` blocks): @apply lines, var() reads outside
  // custom-property statements, Sass and Less reads the bar cannot follow
  const kitVar = (name) => { if (!kitRe) return false; kitRe.lastIndex = 0; const hit = kitRe.test(`var(${name}`); kitRe.lastIndex = 0; return hit; };
  // A Sass or Less variable's colour: its own package's statement first (a
  // plain one over a !default one, then first stated), followed through
  // other variables, #{} interpolation and a plain var() wrapper to a
  // literal. A function (darken(), rgba($x, .5), map-get(), a theme
  // function) is a colour the bar cannot read: the name is drawn without a
  // swatch. A variable defined nowhere in the repo is UNDEF.
  const preCache = new Map();
  const resolvePre = (name, pkg, depth = 0) => {
    const key = `${pkg}\u0000${name}`;
    if (preCache.has(key)) return preCache.get(key);
    preCache.set(key, OPAQUE); // cycle guard
    const list = preDefs.get(name);
    let r;
    if (!list?.length || depth > 8) r = UNDEF;
    else {
      const own = list.filter((x) => x.pkg === pkg);
      const pool = own.length ? own : list;
      const d = pool.reduce((a, b) => ((Number(a.dflt) - Number(b.dflt) || a.order - b.order) <= 0 ? a : b));
      const v = d.value.replace(/\s*!(?:default|global|important)\s*$/g, '').replace(/#\{\s*(\$[\w-]+)\s*\}/g, '$1').trim();
      const ref = /^[$@][\w-]+$/.test(v) ? v : null;
      if (ref) r = resolvePre(ref, d.pkg, depth + 1);
      else {
        const lit = resolveValue(v, d.pkg, depth + 1);
        r = lit === null ? (/^[\w.-]+\(/.test(v) || /[$@][\w-]+/.test(v) ? OPAQUE : null) : lit;
      }
    }
    preCache.set(key, r);
    return r;
  };
  for (const { f, pkg, st, text, inCode } of sheets) {
    if (isDemoPath(f) || isDoor(f)) continue;
    if (tw && text.includes('@apply')) for (const a of text.match(/@apply[^;}]*/g) ?? []) classUses(records(a), f, pkg, { apply: true });
    for (const d of st.decls) {
      for (const m of d.value.matchAll(VAR_RE)) {
        // a css`` block's kit reads are counted with its file's code
        if (kitVar(m[1])) { if (!inCode) kitUse(m[1], f); continue; }
        varUse(m[1], f, pkg, COLOUR_PROP_RE.test(d.prop));
      }
    }
    if (!inCode && /\.(scss|sass|less)$/i.test(f)) {
      const less = /\.less$/i.test(f);
      for (const m of text.matchAll(SHEET_COLOUR_DECL_RE)) {
        const reads = m[2].match(less ? /@[\w-]+/g : /\$[\w-]+/g) ?? [];
        // in a shorthand, a variable named like a length is not a colour
        const colourReads = SHORTHAND_RE.test(m[1]) ? reads.filter((v) => !LENGTH_NAME_RE.test(v)) : reads;
        for (const name of colourReads) {
          // a variable the repo defines is the theme by name, with its
          // colour when it is readable; one defined nowhere in the repo (a
          // package's tokens, @carbon/themes) is still a read the bar
          // cannot follow
          const r = resolvePre(name, pkg);
          if (r === UNDEF) { unreadable[less ? 'less' : 'sass'] += 1; continue; }
          readBy[less ? 'less' : 'sass'] += 1;
          if (isLiteral(r)) tokenUse({ ...r, name }, 'vars', f);
          else tokenUse({ name }, 'vars', f);
        }
      }
    }
  }
  function kitUse(ref, file) {
    const key = kitKey(ref);
    const s = segOf(`k|${key}`, { state: 'token', named: 'kit' });
    s.kit += 1; note(s, key, file);
    totals.kit += 1;
  }

  // code: the records taken while each file was open
  // the repo's JavaScript theme objects, read once, only when a file reads one
  let jsPaths = null;
  const jsThemePaths = () => {
    if (jsPaths) return jsPaths;
    const candidates = (files.code ?? []).filter((f) => /\.[cm]?[jt]sx?$/.test(f) && !/\.d\.ts$/.test(f) && !SKIP_THEME_FILE_RE.test(f) && (tokenSources.has(f) || THEME_FILE_RE.test(f)));
    jsPaths = themePaths(candidates, (f) => readSource(join(root, f)) ?? '');
    return jsPaths;
  };
  // theme.font.color.tertiary -> font.color.tertiary
  const readPath = (read) => read.replace(/^(?:props\.)?(?:theme|tokens|token|cssVar)\./, '');
  const jsUse = (read, file, pkg) => {
    const hits = lookupThemePath(jsThemePaths(), readPath(read));
    if (hits === undefined) { unreadable.js += 1; return; }
    readBy.js += 1;
    // the first statement that reads to a literal; failing that, the name
    let r = null;
    for (const h of hits) { if (typeof h.value !== 'string') continue; const x = resolveValue(h.value, pkg); if (isLiteral(x)) { r = x; break; } }
    if (r) tokenUse({ ...r, name: read }, 'vars', file);
    else tokenUse({ name: read }, 'vars', file);
  };
  const codeUses = (r, { installed = false } = {}) => {
    for (const ref of r.kitRefs) kitUse(ref, r.f);
    for (const read of r.js) jsUse(read, r.f, r.pkg);
    for (const name of r.arbVars) varUse(name, r.f, r.pkg, true);
    for (const name of r.vars) varUse(name, r.f, r.pkg, false);
    classUses(r.classes, r.f, r.pkg, { installed, drift: r.drift, ruled: r.ruled });
  };
  const doorFiles = codeFiles.filter((r) => r.door);
  for (const r of codeFiles) if (!r.door) codeUses(r);

  // written values: the harvest's count, less the definitions
  const tokenNames = new Map();
  for (const c of tokens.colors ?? []) {
    const canon = canonical(c.value) ?? `raw:${c.value}`;
    const written = Math.max(0, c.count - (defWrites.get(canon) ?? 0));
    if (!written) continue;
    const s = segOf(`w|${canon}`, { canon, value: c.value, state: 'stray' });
    s.written += written;
    s.token = !!c.isToken;
    // the file writing it most by hand: the harvest's count there less the
    // definitions there (excalidraw's #ffffff is defined 8 times in
    // theme.scss and written by hand most in App.cursor.ts); none when every
    // file the harvest lists only defines it
    const top = (c.files ?? []).map(({ file, count }) => [file, count - (defWritesIn.get(`${canon}\u0000${file}`) ?? 0)])
      .filter(([, k]) => k > 0).sort((a, b) => b[1] - a[1])[0] ?? null;
    if (top) s.files.set(top[0], top[1]);
    // the names that hold this colour as the bar reads them: a name whose
    // daylight value is another colour (Ghost's --white is #fff; #15171a is
    // only its dark-mode value) is not this colour's name
    if (c.names?.length) {
      const pkg = top ? pkgOf(top[0]) : '';
      const same = c.names.filter((nm) => { const r = nm.startsWith('--') ? resolveName(nm, pkg) : null; return isLiteral(r) && r.canon === canon; });
      if (same.length) tokenNames.set(`w|${canon}`, same);
    }
    totals.written += written;
    if (c.isToken) totals.writtenTokenValue += written;
  }

  // nothing of the repo's own uses colour yet: count shadcn's components too
  let scope = 'own';
  const usesSoFar = () => totals.classes + totals.vars + totals.kit + totals.outside + totals.palette + totals.paletteStray + totals.written;
  if (doorFiles.length && usesSoFar() < INSTALLED_MIN) {
    scope = 'installed';
    for (const r of doorFiles) codeUses(r, { installed: true });
  }

  const all = [...seg.entries()].map(([key, s]) => {
    const names = s.state === 'stray' && s.written ? (tokenNames.get(key) ?? []).slice(0, 3)
      : [...s.names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nm]) => nm);
    return {
      value: s.value, canon: s.canon, state: s.state, named: s.named,
      weight: s.classes + s.vars + s.kit + s.palette + s.written,
      classes: s.classes, vars: s.vars, kit: s.kit, palette: s.palette, written: s.written,
      ...(s.written ? { token: s.token } : {}),
      ...(s.dark ? { dark: true } : {}),
      names,
      file: [...s.files.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    };
  }).filter((s) => s.weight > 0).sort((a, b) => b.weight - a.weight || (a.canon ?? a.names[0] ?? '').localeCompare(b.canon ?? b.names[0] ?? ''));
  totals.total = usesSoFar();
  const restOf = (state) => {
    const xs = all.slice(SHOWN).filter((s) => s.state === state);
    const sum = (ys) => ys.reduce((n, s) => n + s.weight, 0);
    if (state !== 'token') return { count: xs.length, weight: sum(xs) };
    // the colours folded into the token tail that are drawn with no swatch
    // (a kit read, a value outside the repo): the legend needs the split
    const named = xs.filter((s) => s.named);
    return { count: xs.length, weight: sum(xs), named: { count: named.length, weight: sum(named) } };
  };
  const total = totals.total;
  const tokenUses = totals.classes + totals.vars + totals.kit + totals.outside;
  const reads = unreadable.sass + unreadable.less + unreadable.js;
  const readShare = reads + total ? reads / (reads + total) : 0;
  // the kinds named are those carrying a tenth of the reads or more
  const fallback = reads && readShare >= UNREADABLE_SHARE
    ? { why: [['sass', unreadable.sass], ['less', unreadable.less], ['js-theme', unreadable.js]].filter(([, n]) => n > 0 && n >= reads * 0.1).sort((a, b) => b[1] - a[1]).map(([w]) => w), share: Math.round(readShare * 1000) / 1000 }
    : null;
  return {
    scope,
    fallback,
    segments: all.slice(0, SHOWN),
    rest: { token: restOf('token'), palette: restOf('palette'), stray: restOf('stray') },
    totals,
    share: total ? { token: tokenUses / total, palette: totals.palette / total, stray: (totals.paletteStray + totals.written) / total } : null,
    // palette classes kept out of the strays, by the one rule's reason
    paletteWhy: { ...why, sidesTop: [...sidesSample.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null },
    // reads of the theme the bar cannot follow, by kind (the fallback's evidence)
    unreadable,
    // reads of a Sass or Less variable or a JavaScript theme value the repo
    // defines, counted by name
    readBy,
    // shadcn's own components left out (scope 'own') or counted (scope 'installed')
    doorFiles: doorFiles.length,
    // classes whose name the repo defines nowhere: they paint nothing
    deadNames: { count: [...dead.values()].reduce((a, b) => a + b, 0), top: [...dead.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5) },
    ms: Date.now() - t0,
  };
}
