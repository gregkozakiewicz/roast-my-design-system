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
import { kitProfile } from './kit-common.mjs';

export const MUI = {
  name: 'MUI',
  kind: 'mui',
  packages: ['@mui/material', '@material-ui/core'],
  importRe: /from\s+['"]@(?:mui|material-ui)\/|require\(\s*['"]@(?:mui|material-ui)\//,
  reexportRe: /export\s+(?:\*|\{[^}]*\})\s+from\s+['"]@(?:mui|material-ui)\//,
  // createTheme(), or a theme handed straight to a provider: Headlamp wraps its
  // graph view in <ThemeProvider theme={(outer) => ({...})}> with its own greys
  themeRe: /\b(?:createTheme|createMuiTheme|extendTheme|experimental_extendTheme|unstable_createMuiStrictModeTheme)\s*\(|<ThemeProvider[^>]*\btheme=\{\s*(?:\(|\{)/,
  // the theme call has to come from MUI: CodeMirror exports a createTheme too
  themeImportRe: /import\s*(?:\{[^}]*\b(?:createTheme|createMuiTheme|extendTheme|experimental_extendTheme|ThemeProvider)\b[^}]*\}|ThemeProvider|createTheme)\s*from\s*['"]@(?:mui|material-ui)\//,
  refRe: /theme\.palette\.|theme\.spacing\(|theme\.typography\.|theme\.shape\.|\bvars\.palette\.|['"](?:primary|secondary|error|warning|info|success|text|background|grey|divider|action|common)\.(?:main|light|dark|contrastText|primary|secondary|disabled|paper|default|hover|selected|black|white|\d{2,3})['"]/g,
  advice: {
    themeCall: 'createTheme()',
    refExamples: '<code>text.secondary</code> and <code>theme.spacing()</code>',
    colourHow: "On an MUI component, point at it: <code>color: 'text.secondary'</code> in sx, or <code>theme.palette.primary.main</code> in a styled() call.",
    spacingHow: (k) => (k.spacingUnit === 'custom'
      ? "This theme's spacing is custom (a function or a responsive config), so a step is not a fixed number of pixels: convert only after checking what <code>theme.spacing(1)</code> is here, and leave the rest."
      : `MUI spacing is a step count: <code>p: 2</code> is <code>theme.spacing(2)</code>, which is ${k.spacingUnit ? `${2 * Number(k.spacingUnit)}px on this theme (one step is ${k.spacingUnit}px)` : '16px on the default theme'}. A spacing that lands exactly on a step becomes the step; one that does not stays.`),
    rulesTheme: (file) => `A colour, a spacing step or a radius is decided in \`${file}\`. On a component, read it: sx paths (\`color: 'text.secondary'\`, \`p: 2\`) or \`theme.palette\` / \`theme.spacing()\` in styled().`,
    rulesSpacing: 'Use spacing steps (`p: 2`), not pixels',
    promptColour: "- Read the theme where the kit reads it: sx paths ('text.secondary', 'primary.main'), theme.palette in styled() and makeStyles. Never import the theme file into a component just to read a hex.",
    promptSpacing: '- A bare number is a spacing step only inside sx and theme.spacing(). Inside style={{}} or a plain style object it is pixels, so convert only in sx.',
    promptInline: "- Move a style to sx or a styled() component only on MUI components or on wrappers that pass their props to one MUI component. Your own wrappers that take a style prop keep style; web components ignore sx.",
  },
};

export default kitProfile(MUI);
