/**
 * File walker + repo profile. Adapted from 1.0's repo-inspect (proffer-spine),
 * widened: the harvester must see EVERYTHING that styles the app — code,
 * stylesheets of any flavor, and config — not just a happy-path shadcn layout.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

export function readJSON(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } }
export function read(p) { try { return readFileSync(p, 'utf8'); } catch { return null; } }

const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', 'dist', 'build', 'out', 'coverage',
  '.turbo', '.vercel', '.cache', 'storybook-static', 'public',
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
export function walkRepo(root, maxDepth = 14) {
  const files = { code: [], styles: [], other: [] };
  const recurse = (dir, depth) => {
    if (depth > maxDepth) return;
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.cursorrules') continue;
      if (SKIP_DIRS.has(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) { recurse(p, depth + 1); continue; }
      if (TEST_FILE_RE.test(e.name)) continue;
      const rel = relative(root, p).replaceAll('\\', '/');
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

  const framework =
    deps.next ? 'next'
    : deps['@remix-run/react'] || deps['@react-router/dev'] ? 'remix'
    : deps.vite && deps.react ? 'vite-react'
    : deps.react ? 'react'
    : 'unknown';

  const componentsJson = readJSON(join(root, 'components.json'));
  const uiDir = ['src/components/ui', 'components/ui', 'app/components/ui'].find((d) => existsSync(join(root, d)));
  const isShadcn = Boolean(componentsJson) || Boolean(uiDir);

  const knownLib = KNOWN_LIBRARIES.find((d) => deps[d.pkg]);
  const homegrown = files.code.filter((f) => /(^|\/)components\//.test(f) && !/\/components\/ui\//.test(f) && /\.(tsx|jsx)$/.test(f));

  let designSystem;
  if (isShadcn) designSystem = { kind: 'shadcn', name: 'shadcn/ui', confidence: 'high' };
  else if (knownLib) designSystem = { kind: 'library', name: knownLib.name, pkg: knownLib.pkg, confidence: 'high' };
  else if (homegrown.length >= 3) designSystem = { kind: 'custom', name: 'custom (unrecognized)', confidence: 'low' };
  else designSystem = { kind: 'none', confidence: 'high' };

  // Import alias from tsconfig paths or components.json
  let alias = null;
  const tsconfig = readJSON(join(root, 'tsconfig.json'));
  const paths = tsconfig?.compilerOptions?.paths;
  if (paths) {
    const key = Object.keys(paths).find((k) => k.endsWith('/*'));
    if (key) alias = key.replace('/*', '');
  }

  const styling = STYLING_DEPS.filter((s) => deps[s.pkg]).map((s) => s.label);

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
  };
}
