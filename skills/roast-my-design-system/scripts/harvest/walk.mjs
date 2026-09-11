/**
 * File walker + repo profile. Adapted from an earlier internal repo inspector,
 * widened: the harvester must see EVERYTHING that styles the app — code,
 * stylesheets of any flavor, and config — not just a happy-path shadcn layout.
 */
import { CATALOGUE } from '../profiles/shadcn-data.mjs';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

export function readJSON(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } }
export function read(p) { try { return readFileSync(p, 'utf8'); } catch { return null; } }

// The harvest reads whole files into memory. One committed minified chart
// bundle or a generated sprite sheet is not design-system evidence, and a
// hostile repo could plant a very large file on purpose; either way the
// scan should shrug. Two megabytes is far above any hand-written source.
export const MAX_SOURCE_BYTES = 2_000_000;
export function readSource(p) {
  try {
    if (statSync(p).size > MAX_SOURCE_BYTES) return null;
    return readFileSync(p, 'utf8');
  } catch { return null; }
}

const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', 'dist', 'build', 'out', 'coverage',
  '.turbo', '.vercel', '.cache', 'storybook-static',
  // Documentation sites (Docusaurus and friends) carry their own theme and
  // demo fixtures — that styling is not the product's design language.
  'docs', 'dev-docs', 'website', 'documentation',
  // Example integrations and demo apps are not the product's design language.
  'examples', 'example', 'demos', 'demo', 'playground', 'fixtures',
  // Test/fixture surfaces are not the product's design language — counting a
  // story's `export const Default` 36× would poison the diagnosis numbers.
  '__tests__', '__mocks__', '__fixtures__', '__snapshots__',
  'cypress', 'e2e', 'playwright', 'test', 'tests', '.storybook',
]);

// Same idea at file granularity: Button.test.tsx / Button.stories.tsx / *.cy.ts
const TEST_FILE_RE = /\.(test|spec|stories|story|cy)\.[cm]?[jt]sx?$/;

// public/ is static assets in almost every repo — but grafana keeps its whole
// frontend under public/app. Skip it only when a quick probe finds no real
// component source inside (component extensions only, so a compiled .js bundle
// someone committed never counts as source).
const SOURCE_PROBE_RE = /\.(tsx|jsx|vue|svelte)$/;
function hasComponentSource(dir, depth = 0) {
  if (depth > 3) return false;
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return false; }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    if (e.isDirectory()) { if (hasComponentSource(join(dir, e.name), depth + 1)) return true; }
    else if (SOURCE_PROBE_RE.test(e.name) && !TEST_FILE_RE.test(e.name)) return true;
  }
  return false;
}

const CODE_EXTS = new Set(['.tsx', '.jsx', '.ts', '.js', '.mjs', '.cjs']);
const STYLE_EXTS = new Set(['.css', '.scss', '.sass', '.less']);

/**
 * Walk the repo, returning relative paths bucketed by role.
 *
 * Depth-capped as a guard against pathological trees, not as a scoping choice.
 * The cap has to clear a monorepo's own overhead: two levels are spent reaching
 * apps/web before the app's routes even begin, and a Next.js route can nest six
 * deep on its own. At 8 that silently dropped 11-12% of the files in dub,
 * twenty and formbricks. Measured across the fleet, file counts stop growing at
 * 12; 14 leaves headroom. Single-package repos are unaffected either way.
 */
export function walkRepo(root, maxDepth = 14, exclusions = null) {
  const files = { code: [], styles: [], other: [] };
  const excluded = exclusions?.match ?? (() => null);
  // An excluded directory is still walked once, just to count what the scan
  // would otherwise have read — the harvest reports how many files each
  // pattern removed, so an exclusion is always visible, never a silent trim.
  const countExcluded = (dir, depth, hit) => {
    if (depth > maxDepth) return;
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.cursorrules') continue;
      if (SKIP_DIRS.has(e.name) || e.isSymbolicLink()) continue;
      if (e.isDirectory()) { countExcluded(join(dir, e.name), depth + 1, hit); continue; }
      if (TEST_FILE_RE.test(e.name)) continue;
      hit.files += 1;
    }
  };
  const recurse = (dir, depth) => {
    if (depth > maxDepth) return;
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.cursorrules') continue;
      if (SKIP_DIRS.has(e.name)) continue;
      // A symlink is followed nowhere: a linked directory was already skipped
      // (isDirectory is false for it), and a linked FILE could point anywhere
      // on the machine, `leak.css -> ~/.ssh/id_rsa` included. The repo's own
      // files are the evidence; what they point at outside it is not.
      if (e.isSymbolicLink()) continue;
      const p = join(dir, e.name);
      if (e.name === 'public' && e.isDirectory() && !hasComponentSource(p)) continue;
      const rel = relative(root, p).replaceAll('\\', '/');
      const hit = excluded(rel);
      if (hit) {
        if (e.isDirectory()) countExcluded(p, depth + 1, hit);
        else if (!TEST_FILE_RE.test(e.name)) hit.files += 1;
        continue;
      }
      if (e.isDirectory()) { recurse(p, depth + 1); continue; }
      if (TEST_FILE_RE.test(e.name)) continue;
      const ext = extname(e.name);
      if (STYLE_EXTS.has(ext)) files.styles.push(rel);
      else if (CODE_EXTS.has(ext)) files.code.push(rel);
      else files.other.push(rel);
    }
  };
  recurse(root, 0);
  return files;
}

// Component libraries we can name on sight (from 1.0's repo-inspect).
const KNOWN_LIBRARIES = [
  { pkg: '@mui/material',     name: 'Material UI' },
  { pkg: '@chakra-ui/react',  name: 'Chakra UI' },
  { pkg: 'antd',              name: 'Ant Design' },
  { pkg: '@mantine/core',     name: 'Mantine' },
  { pkg: '@heroui/react',     name: 'HeroUI' },
  { pkg: '@nextui-org/react', name: 'NextUI' },
  { pkg: '@radix-ui/themes',  name: 'Radix Themes' },
  { pkg: '@fluentui/react',   name: 'Fluent UI' },
  { pkg: 'react-bootstrap',   name: 'React Bootstrap' },
  { pkg: 'grommet',           name: 'Grommet' },
];

const STYLING_DEPS = [
  { pkg: 'tailwindcss',          label: 'Tailwind CSS' },
  { pkg: 'styled-components',    label: 'styled-components' },
  { pkg: '@emotion/react',       label: 'Emotion' },
  { pkg: '@emotion/styled',      label: 'Emotion (styled)' },
  { pkg: 'sass',                 label: 'Sass' },
  { pkg: 'less',                 label: 'Less' },
  { pkg: '@vanilla-extract/css', label: 'vanilla-extract' },
  { pkg: '@stitches/react',      label: 'Stitches' },
  { pkg: 'class-variance-authority', label: 'CVA' },
];

/** Framework + design-system classification (1.0 logic, widened for monorepos). */
export function profileRepo(root, files) {
  const pkg = readJSON(join(root, 'package.json')) || {};
  // Monorepos keep real deps in workspace sub-packages — merge every
  // package.json the walk saw (root values win on conflict).
  const pkgFiles = files.other.filter((f) => f.endsWith('package.json'));
  let deps = {};
  for (const f of pkgFiles) {
    const sub = readJSON(join(root, f));
    if (sub) deps = { ...deps, ...sub.dependencies, ...sub.devDependencies };
  }
  deps = { ...deps, ...pkg.dependencies, ...pkg.devDependencies };
  const monorepo = pkgFiles.some((f) => f !== 'package.json');

  // Hand-built sites are a real category, not a detection failure: "unknown"
  // next to a good score reads like a shrug, so name what is actually there.
  const htmlFiles = files.other.filter((f) => /\.html?$/.test(f)).length;
  // Web-component builders come FIRST: a Stencil monorepo ships generated
  // React/Vue/Angular wrappers whose deps would otherwise win, and calling
  // Telekom's Stencil system "react" is how a report loses its reader in one
  // glance (learned on telekom/scale, 2026-09-01).
  const framework =
    deps['@stencil/core'] ? 'web components (Stencil)'
    : deps.lit || deps['lit-element'] ? 'web components (Lit)'
    : deps.next ? 'next'
    : deps['@remix-run/react'] || deps['@react-router/dev'] ? 'remix'
    : deps.vite && deps.react ? 'vite-react'
    : deps.react ? 'react'
    : deps.vue ? 'vue'
    : deps['@angular/core'] ? 'angular'
    : deps.svelte ? 'svelte'
    : htmlFiles > 0 ? 'static HTML/CSS'
    : 'unknown';

  // A published components package marks a LIBRARY: a repo whose consumers
  // live in other repos entirely. The distinction changes what usage counts
  // mean (composition, not adoption) and how orphans may be judged.
  // Two honest signals: the ROOT package being publishable (private !== true
  // with a main/module/exports) marks the whole repo as the product being
  // shipped, whatever it is named (Shoelace); a publishable SUB-package needs
  // a components-ish name, or every monorepo publishing anything would flip.
  let libraryPkg = null;
  if (pkg.private !== true && (pkg.main || pkg.module || pkg.exports)) libraryPkg = pkg.name ?? 'root package';
  if (!libraryPkg) {
    for (const f of pkgFiles) {
      if (f === 'package.json') continue;
      const p = readJSON(join(root, f));
      if (!p || p.private === true) continue;
      if (!(p.main || p.module || p.exports)) continue;
      if (/components|design.?system|design.?tokens|ui-kit|\bui\b/i.test(p.name ?? '')) { libraryPkg = p.name; break; }
    }
  }

  const componentsJson = readJSON(join(root, 'components.json'));
  const uiDir = ['src/components/ui', 'components/ui', 'app/components/ui'].find((d) => existsSync(join(root, d)));
  const isShadcn = Boolean(componentsJson) || Boolean(uiDir);

  // Catalogue filenames as shipped by `shadcn add --all` (61 as of 2026-09).
  // Only used to recognise a vendored folder, never to judge one.
  const SHADCN_CATALOGUE = CATALOGUE;
  let catalogueNames = 0;
  if (uiDir) {
    try {
      for (const f of readdirSync(join(root, uiDir))) {
        if (SHADCN_CATALOGUE.has(f.replace(/\.[cm]?[jt]sx?$/, ''))) catalogueNames += 1;
      }
    } catch { /* unreadable */ }
  }
  const vendoredUi = Boolean(uiDir) && (Boolean(componentsJson) || catalogueNames >= 8);

  const knownLib = KNOWN_LIBRARIES.find((d) => deps[d.pkg]);
  const homegrown = files.code.filter((f) => /(^|\/)components\//.test(f) && !/\/components\/ui\//.test(f) && /\.(tsx|jsx)$/.test(f));

  // A design system does not have to arrive through npm. A stylesheet defining
  // a real set of CSS custom properties IS one — arguably the purest form —
  // and calling it "none" undersells exactly the discipline the ideal asks for.
  const tokenDefs = files.styles.slice(0, 8).reduce((sum, f) => {
    const css = read(join(root, f));
    return sum + (css ? (css.match(/--[A-Za-z0-9_-]+\s*:/g) ?? []).length : 0);
  }, 0);

  let designSystem;
  // shadcn's components.json records whether colours live in CSS variables
  // (the default) or in utility classes (cssVariables: false). In the second
  // mode a repo has no colour tokens BY DESIGN, and the report must say so
  // instead of reading "0 tokens" as neglect.
  const shadcnCssVars = componentsJson?.tailwind?.cssVariables !== false;
  if (isShadcn) designSystem = { kind: 'shadcn', name: 'shadcn/ui', confidence: 'high', cssVariables: shadcnCssVars };
  else if (knownLib) designSystem = { kind: 'library', name: knownLib.name, pkg: knownLib.pkg, confidence: 'high' };
  else if (homegrown.length >= 3) designSystem = { kind: 'custom', name: 'custom (unrecognized)', confidence: 'low' };
  else if (tokenDefs >= 5) designSystem = { kind: 'custom', name: 'CSS tokens', confidence: 'medium' };
  else designSystem = { kind: 'none', confidence: 'high' };

  // Import alias from tsconfig paths or components.json
  let alias = null;
  const tsconfig = readJSON(join(root, 'tsconfig.json'));
  const paths = tsconfig?.compilerOptions?.paths;
  if (paths) {
    const key = Object.keys(paths).find((k) => k.endsWith('/*'));
    if (key) alias = key.replace('/*', '');
  }

  // No toolchain in package.json does not mean no styling: if the walk found
  // real stylesheets, plain CSS is what is there — say so, not "none detected".
  let styling = STYLING_DEPS.filter((s) => deps[s.pkg]).map((s) => s.label);
  if (!styling.length && files.styles.length) styling = ['plain CSS'];

  // The git remote is a far better identity than package.json's name field
  // ("chatbot" vs "vercel/ai-chatbot"). Parsed from .git/config, no git exec.
  let remoteSlug = null;
  try {
    const gitConfig = readFileSync(join(root, '.git/config'), 'utf8');
    const m = gitConfig.match(/url\s*=\s*(?:https?:\/\/|git@)([^\/:]+)[\/:]([^\s\/]+\/[^\s\/]+?)(?:\.git)?\s*$/m);
    if (m && /github|gitlab|bitbucket|codeberg/.test(m[1])) remoteSlug = m[2];
  } catch { /* not a clone, or no remote: fall back to pkg name */ }

  return {
    name: remoteSlug || pkg.name || null,
    pkgName: pkg.name || null,
    monorepo,
    framework,
    typescript: Boolean(deps.typescript || existsSync(join(root, 'tsconfig.json'))),
    designSystem,
    stylingDeps: styling,
    importAlias: componentsJson?.aliases?.components?.split('/')[0] || alias || null,
    uiDir: uiDir || null,
    // A vendored catalogue is not components this team wrote: `shadcn add`
    // copies the source in, and people bring the whole set at once because
    // adding them one at a time gets tedious. So an unused one is stock on a
    // shelf, not dead weight — and it is arguably protective, because an agent
    // reaches for it instead of hand-rolling a worse version. (Sahaj Jain, who
    // maintains tweakcn, 2026-09-09; a factory-fresh install scored 75 and was
    // told to delete its own catalogue.) Consumers read this flag rather than
    // re-deriving it.
    //
    // A folder named components/ui is NOT enough on its own: plenty of teams
    // write their own components there, and calling that a catalogue would
    // wave through genuinely abandoned code. Two independent signals, either
    // sufficient: components.json (the CLI's own marker, written by every
    // modern install) or a folder that is demonstrably the catalogue by name
    // (shadcn-ui/taxonomy predates components.json and has 111 of them).
    vendoredUi,
    libraryPkg,
    // markers the component detector cannot read (yet): used by the harvest
    // to declare component metrics "not measured" instead of scoring zeros
    unreadableComponentStack:
      deps.vue || files.other.some((f) => f.endsWith('.vue')) ? 'Vue single-file components'
      : deps['@angular/core'] ? 'Angular components'
      : deps.svelte || files.other.some((f) => f.endsWith('.svelte')) ? 'Svelte components'
      : null,
  };
}
