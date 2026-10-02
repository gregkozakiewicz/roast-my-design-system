/**
 * JavaScript theme objects, read for the colour-use bar (9.9.0). A theme
 * kept as an object literal (styled-components, emotion, a design system's
 * own tokens file) is read into flat key paths: THEME_LIGHT.font.color.tertiary
 * becomes "font.color.tertiary" with its string value. A value that names
 * another path (textSecondary: colors.slateDark) is kept as a reference and
 * followed later; a call (lighten(0.1, colors.slate)), a template or a
 * spread is kept as null: defined, not readable here.
 *
 * It reads object literals only, wherever they sit in the file: after `=`,
 * after `return`, or as an argument. It runs no code. The kit profiles
 * (MUI, Mantine, Chakra, Ant Design) read their themes their own way and
 * never come here.
 */

const IDENT = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/;

/**
 * Every object literal in a source text, flattened: path -> value, where
 * value is a string, { ref } for an identifier chain, or null. The first
 * statement of a path wins. Paths are relative to each literal's own root.
 * @returns Map<string, string | { ref: string } | null>
 */
export function objectPaths(src) {
  const text = src.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length)).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length));
  const out = new Map();
  const parsed = [];
  const re = /(?:=|return|\(|,|=>)\s*\{/g;
  let m;
  while ((m = re.exec(text))) {
    const start = m.index + m[0].length - 1;
    if (parsed.some(([a, b]) => start >= a && start < b)) continue;
    // a function body, not a literal: its first token is a statement
    // keyword or a call; the literals inside it are found on their own
    const head = text.slice(start + 1, start + 80).trimStart();
    if (/^(?:return|const|let|var|if|for|while|switch|try|throw|function|export|import|await|yield)\b/.test(head) || /^[\w$.]+\s*\(/.test(head) || head.startsWith('}')) continue;
    const end = readObject(text, start, [], out);
    if (end > start) parsed.push([start, end]);
  }
  return out;
}

function readObject(s, start, path, out) {
  let i = start + 1;
  const ws = () => { while (i < s.length && /[\s,;]/.test(s[i])) i++; };
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
  while (i < s.length && guard++ < 20000) {
    ws();
    if (i >= s.length) return i;
    if (s[i] === '}') return i + 1;
    if (s.startsWith('...', i)) { i += 3; skipExpr(); continue; }
    let key = null;
    if (s[i] === '"' || s[i] === "'") key = readString();
    else if (s[i] === '[') { skipExpr(); continue; }
    else {
      const k = /^[\w$-]+/.exec(s.slice(i, i + 200));
      if (!k) { skipExpr(); if (s[i] === '}') return i + 1; continue; }
      key = k[0]; i += key.length;
    }
    while (i < s.length && /\s/.test(s[i])) i++;
    // a method or a shorthand property: not a value
    if (s[i] !== ':') { skipExpr(); continue; }
    i += 1;
    while (i < s.length && /\s/.test(s[i])) i++;
    const name = [...path, key].join('.');
    if (s[i] === '{') { i = readObject(s, i, [...path, key], out); continue; }
    if (s[i] === '"' || s[i] === "'") {
      const v = readString();
      if (!out.has(name)) out.set(name, v.trim());
      continue;
    }
    const id = IDENT.exec(s.slice(i, i + 300));
    if (id && !/^\s*\(/.test(s.slice(i + id[0].length, i + id[0].length + 3)) && !/^(?:true|false|null|undefined)$/.test(id[0]) && !/^\d/.test(id[0])) {
      // an identifier chain ending the value: a reference to another path
      const after = s.slice(i + id[0].length, i + id[0].length + 40);
      if (/^\s*(?:[,}]|\n|$)/.test(after)) { if (!out.has(name)) out.set(name, { ref: id[0] }); i += id[0].length; continue; }
    }
    // a number, a boolean, null or undefined is not a colour statement at all
    if (!out.has(name) && !/^-?\d/.test(s.slice(i, i + 2)) && !/^(?:true|false|null|undefined)\b/.test(s.slice(i, i + 10))) out.set(name, null);
    skipExpr();
  }
  return i;
}

/**
 * The theme paths a repo defines, from its theme files, as one map. A path
 * is kept with the file that stated it first; a daylight file (ThemeLight,
 * light-colors) is read before an evening one (ThemeDark), so a read lands
 * on the daylight value.
 */
export function themePaths(files, read) {
  const dark = (f) => /dark/i.test(f.split('/').pop());
  const ordered = [...files].sort((a, b) => Number(dark(a)) - Number(dark(b)) || a.localeCompare(b));
  const all = new Map();
  for (const f of ordered) {
    const src = read(f);
    if (!src) continue;
    // every statement of a path is kept, in file order: twenty states
    // background.tertiary as var(--t-background-tertiary) in one file and
    // as a literal in another, and the reader takes the first it can read
    for (const [k, v] of objectPaths(src)) { const list = all.get(k) ?? []; list.push({ v, file: f }); all.set(k, list); }
  }
  return all;
}

/**
 * The value behind a theme read such as "font.color.tertiary" or
 * "colors.primary600": the full path first, then the same path with its
 * leading segments dropped (strapi reads theme.colors.primary600 from an
 * object keyed primary600). A reference is followed, a few steps. Returns
 * { value, file } with value a string, or null for a path that is defined
 * but not readable, or undefined for one defined nowhere. Several
 * statements come back as a list, readable ones included, in file order.
 */
export function lookupThemePath(paths, readPath, depth = 0) {
  const segs = readPath.split('.').filter(Boolean);
  for (let drop = 0; drop < segs.length; drop++) {
    const key = segs.slice(drop).join('.');
    if (!paths.has(key)) continue;
    const out = [];
    for (const { v, file } of paths.get(key)) {
      if (typeof v === 'string') out.push({ value: v, file });
      else if (v && typeof v === 'object' && v.ref && depth < 4) {
        const r = lookupThemePath(paths, v.ref, depth + 1);
        out.push(...(r?.length ? r : [{ value: null, file }]));
      } else out.push({ value: null, file });
    }
    return out;
  }
  return undefined;
}
