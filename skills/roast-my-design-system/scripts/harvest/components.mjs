/**
 * Component harvest — every component defined in the repo, with its REAL prop
 * signature and where it is actually used. Parsers lifted from 1.0's
 * compile-skill.mjs — brace/string-aware regex parsing,
 * no AST dependency — then extended to scan the whole repo, not one ui/ dir.
 */
import { readFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const QUOTES = new Set(['"', "'", '`']);

// ---- brace/string-aware helpers (verbatim from 1.0) ----
export function sliceObject(text, from) {
  const open = text.indexOf('{', from);
  if (open === -1) return null;
  let depth = 0, str = null;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (str) { if (c === str && text[i - 1] !== '\\') str = null; continue; }
    if (QUOTES.has(c)) { str = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return { inner: text.slice(open + 1, i), end: i }; }
  }
  return null;
}
function topLevelKeys(inner) {
  const keys = [];
  let depth = 0, str = null, i = 0;
  while (i < inner.length) {
    const c = inner[i];
    if (str) { if (c === str && inner[i - 1] !== '\\') str = null; i++; continue; }
    if (QUOTES.has(c)) { str = c; i++; continue; }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    else if (depth === 0 && (i === 0 || /[\s,{]/.test(inner[i - 1]))) {
      const m = /^([A-Za-z_][\w-]*)\s*:/.exec(inner.slice(i));
      if (m) { keys.push(m[1]); i += m[0].length; continue; }
    }
    i++;
  }
  return [...new Set(keys)];
}
function topLevelColon(s) {
  let depth = 0, str = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (str) { if (c === str && s[i - 1] !== '\\') str = null; continue; }
    if (QUOTES.has(c)) { str = c; continue; }
    if ('{<(['.includes(c)) depth++;
    else if ('}>)]'.includes(c)) depth--;
    else if (c === ':' && depth === 0) return i;
  }
  return -1;
}

// ---- extraction (from 1.0, generalized) ----
function extractVariants(src) {
  const idx = src.indexOf('variants:');
  if (idx === -1) return {};
  const block = sliceObject(src, idx);
  if (!block) return {};
  const out = {};
  for (const group of topLevelKeys(block.inner)) {
    const gi = block.inner.indexOf(`${group}:`);
    const gb = sliceObject(block.inner, gi);
    if (gb) out[group] = topLevelKeys(gb.inner);
  }
  return out;
}

function extractPropsHint(src, name) {
  const sig = new RegExp(`function\\s+${name}\\s*\\(([\\s\\S]*?)\\)\\s*\\{`).exec(src)
           || new RegExp(`const\\s+${name}\\s*=[\\s\\S]{0,120}?\\(\\s*([\\s\\S]*?)\\)\\s*=>`).exec(src);
  if (!sig) return null;
  const params = sig[1].trim();
  const colon = topLevelColon(params);
  const destructure = colon > -1 ? params.slice(0, colon) : params;
  const typeAnno = (colon > -1 ? params.slice(colon + 1) : '').trim().replace(/\s+/g, ' ');
  const skip = new Set(['className', 'children', 'props', 'ref', 'key',
    'true', 'false', 'null', 'undefined']); // default-value literals, not props
  const named = [...new Set([...destructure.matchAll(/([A-Za-z_]\w*)\s*(?=[,}=:])/g)].map((m) => m[1]))]
    .filter((n) => !skip.has(n));
  return (typeAnno || named.length) ? { type: typeAnno || null, named } : null;
}

/** Capitalized components DEFINED in a source file (declared, not just re-exported).
 *  Exported for the MCP validation engine, which checks a snippet's definitions
 *  against the ledger with the same detector the harvest uses. */
export function definedComponents(src) {
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Z]\w*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s+const\s+([A-Z]\w*)\s*(?::[^=]+)?=\s*([^\s;]{1,40})/g)) {
    // ALL_CAPS names are constants; a value starting with a literal
    // ({...}, [...], "...", 42) is data, not a component
    if (/^[A-Z][A-Z0-9_]+$/.test(m[1])) continue;
    if (/^[\[{'"`0-9]/.test(m[2])) continue;
    names.add(m[1]);
  }
  // Class components (CRA/redux-era): `class Login extends React.Component`
  for (const m of src.matchAll(/class\s+([A-Z]\w*)\s+extends\s+(?:React\.)?(?:Pure)?Component/g)) names.add(m[1]);
  // `export default Foo` / `export default connect(...)(Foo)` — the LAST
  // capitalized identifier on the line is the component being exported.
  for (const m of src.matchAll(/export\s+default\s+([^\n;]{1,200})/g)) {
    const ids = m[1].match(/\b[A-Z]\w*/g);
    const last = ids?.[ids.length - 1];
    if (last && new RegExp(`(?:function|const|class)\\s+${last}\\b`).test(src)) names.add(last);
  }
  // `function Foo(...)` declared then exported via `export { Foo }`
  const exported = new Set();
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(/\s+as\s+/).pop().trim().replace(/^type\s+/, '');
      if (/^[A-Z]\w*$/.test(n)) exported.add(n);
    }
  }
  for (const n of exported) {
    if (new RegExp(`(?:function|const)\\s+${n}\\b`).test(src)) names.add(n);
  }
  // Only keep names that render JSX or wrap a primitive (heuristic: file has JSX at all)
  return [...names];
}

const looksLikeJSXFile = (src) => /<[A-Za-z][\w.]*[\s/>]/.test(src);

/** Count real `<Name` tag usages of `name` in `src` (tag boundary checked). */
function countUsages(src, name) {
  let count = 0, from = 0, open;
  while ((open = src.indexOf(`<${name}`, from)) !== -1) {
    const after = src[open + name.length + 1];
    if (!after || /[\s/>]/.test(after)) count++;
    from = open + name.length + 1;
  }
  return count;
}

/**
 * Harvest all components: definitions (with variants/props) + usages across the
 * repo. `codeFiles` are relative paths; returns { components, totalDefined }.
 */
export function harvestComponents(root, codeFiles) {
  // .js too — CRA-era repos (a big slice of the messy-repo audience) put JSX in
  // plain .js files; requiring .tsx/.jsx made whole repos read as empty.
  const jsxFiles = codeFiles.filter((f) => /\.(tsx|jsx|js)$/.test(f));
  const sources = new Map();
  for (const f of jsxFiles) {
    try {
      const src = readFileSync(join(root, f), 'utf8');
      if (looksLikeJSXFile(src)) sources.set(f, src);
    } catch { /* skip */ }
  }

  // Pass 1: definitions
  const components = [];
  for (const [file, src] of sources) {
    if (!looksLikeJSXFile(src)) continue;
    const isPage = /(^|\/)(app\/.*page|pages\/(?!_app|_document|api))/.test(file)
      || /(^|\/)app\/.*\/(layout|template|error|loading)\.(tsx|jsx)$/.test(file);
    for (const name of definedComponents(src)) {
      components.push({
        name,
        file,
        isPage,
        variants: extractVariants(src),
        propsHint: extractPropsHint(src, name),
        usageCount: 0,
        usedIn: [],
      });
    }
  }

  // Pass 2: usages (skip the defining file's own render of itself is fine to count)
  const byName = new Map();
  for (const c of components) {
    if (!byName.has(c.name)) byName.set(c.name, []);
    byName.get(c.name).push(c);
  }
  for (const [file, src] of sources) {
    for (const [name, defs] of byName) {
      const n = countUsages(src, name);
      if (n === 0) continue;
      for (const def of defs) {
        if (def.file === file) continue; // internal render/recursion, not adoption
        def.usageCount += n;
        if (def.usedIn.length < 8) def.usedIn.push(file);
      }
    }
  }

  components.sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name));

  // Pass 3: golden examples — for the most-used components, quote the repo's
  // own most common usage, verbatim, with a receipt. Descriptive, never
  // invented: we photograph the plate that leaves the kitchen most often.
  // A component with no dominant pattern gets no example (printing one would
  // be a lie), and a component used a handful of times is not a pattern yet.
  const uniqueNames = new Set([...byName].filter(([, d]) => d.length === 1).map(([n]) => n));
  const candidates = components
    .filter((c) => !c.isPage && c.usageCount >= 6 && uniqueNames.has(c.name))
    .slice(0, 12);
  for (const c of candidates) {
    const found = []; // { tag, file }
    for (const [file, src] of sources) {
      if (file === c.file) continue;
      let from = 0, open;
      while ((open = src.indexOf(`<${c.name}`, from)) !== -1) {
        from = open + c.name.length + 1;
        const after = src[open + c.name.length + 1];
        if (after && !/[\s/>]/.test(after)) continue;
        const tag = sliceTag(src, open);
        if (tag && tag.length <= 220 && !tag.includes('`')) found.push({ tag, file });
        if (found.length > 400) break;
      }
    }
    if (found.length < 5) continue;
    // Group by prop-name signature; the winner must be a real majority habit.
    const sigOf = (tag) => [...tag.matchAll(/[\s({]([A-Za-z_][\w-]*)=/g)].map((m) => m[1]).sort().join(',');
    const groups = new Map();
    for (const u of found) {
      const s = sigOf(u.tag);
      (groups.get(s) ?? groups.set(s, []).get(s)).push(u);
    }
    const [sig, top] = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (top.length < 3 || top.length / found.length < 0.4) continue;
    // The shortest real tag with the dominant signature is the cleanest quote.
    const best = [...top].sort((a, b) => a.tag.length - b.tag.length)[0];
    const selfClosed = /\/>\s*$/.test(best.tag);
    c.usageExample = {
      snippet: `${best.tag.replace(/\s+/g, ' ').trim()}${selfClosed ? '' : `…</${c.name}>`}`,
      file: best.file,
      matches: top.length,
      total: found.length,
      props: sig || null,
    };
  }

  return { components, totalDefined: components.length };
}

/**
 * Slice a JSX opening tag from `<` to its matching `>`, string- and
 * brace-aware so `onClick={() => a > b}` cannot end the tag early.
 */
function sliceTag(src, open) {
  let depth = 0, str = null;
  const limit = Math.min(src.length, open + 400);
  for (let i = open; i < limit; i++) {
    const c = src[i];
    if (str) { if (c === str && src[i - 1] !== '\\') str = null; continue; }
    if (QUOTES.has(c)) { str = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return src.slice(open, i + 1);
  }
  return null;
}
