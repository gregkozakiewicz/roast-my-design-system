/**
 * The mui profile: a product built on MUI (Material UI), the kit installed
 * from npm. The theme is a createTheme() call in the repo; components read it
 * through sx paths ('text.secondary', p: 2) and theme.palette. What drifts is
 * a colour or a pixel size written straight onto a component where the theme
 * has one.
 *
 * Recognised by use, not by the dependency alone: Mattermost lists MUI and
 * imports it in 10 of 5,737 files (2026-09-17), which is not an MUI product.
 * Older MUI (@material-ui/*, v4) counts: Backstage imports it in 595 files.
 */
import { countKitPaint } from '../lib/kitpaint.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const MUI = {
  name: 'MUI',
  importRe: /from\s+['"]@(?:mui|material-ui)\/|require\(\s*['"]@(?:mui|material-ui)\//,
  // createTheme(), or a theme handed straight to a provider: Headlamp wraps its
  // graph view in <ThemeProvider theme={(outer) => ({...})}> with its own greys
  themeRe: /\b(?:createTheme|createMuiTheme|extendTheme|experimental_extendTheme|unstable_createMuiStrictModeTheme)\s*\(|<ThemeProvider[^>]*\btheme=\{\s*(?:\(|\{)/,
  // the theme call has to come from MUI: CodeMirror exports a createTheme too
  themeImportRe: /import\s*(?:\{[^}]*\b(?:createTheme|createMuiTheme|extendTheme|experimental_extendTheme|ThemeProvider)\b[^}]*\}|ThemeProvider|createTheme)\s*from\s*['"]@(?:mui|material-ui)\//,
  refRe: /theme\.palette\.|theme\.spacing\(|theme\.typography\.|theme\.shape\.|\bvars\.palette\.|['"](?:primary|secondary|error|warning|info|success|text|background|grey|divider|action|common)\.(?:main|light|dark|contrastText|primary|secondary|disabled|paper|default|hover|selected|black|white|\d{2,3})['"]/g,
};

// enough use to call it the kit the product is built on
const MIN_FILES = 30;

export default {
  kind: 'mui',

  recognise(profile, counts, ctx) {
    if (!ctx?.root || !ctx?.files) return null;
    const pkg = profile.designSystem?.pkg;
    // a cheap gate before reading every file: the dependency is somewhere
    if (!(pkg === '@mui/material' || (ctx.files.other ?? []).some((f) => f.endsWith('package.json') && /"@(?:mui\/material|material-ui\/core)"/.test(readSafe(join(ctx.root, f)))))) return null;
    const paint = countKitPaint(ctx.root, ctx.files.code, MUI);
    if (paint.kitFiles < MIN_FILES) return null;
    profile.designSystem = { kind: 'kit', name: MUI.name, pkg: '@mui/material', confidence: 'high' };
    profile.kit = { name: MUI.name, ...paint };
    return {
      confidence: paint.themeFiles.length ? 'high' : 'medium',
      evidence: [
        `MUI imported in ${paint.kitFiles} files`,
        paint.themeFiles.length ? `theme defined in ${paint.themeFiles[0]}${paint.themeFiles.length > 1 ? ` and ${paint.themeFiles.length - 1} more` : ''}` : 'no createTheme() found: the default MUI theme',
        `the theme is referenced ${paint.refs} times from components`,
      ],
    };
  },
};

function readSafe(p) { try { return readFileSync(p, 'utf8'); } catch { return ''; } }
