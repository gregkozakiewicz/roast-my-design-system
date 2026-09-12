/**
 * shadcn facts the profile reads against. Everything here was read out of
 * shadcn/ui's own source and docs (MIT, github.com/shadcn-ui/ui) on
 * 2026-09-11 and out of tweakcn (Apache 2.0, github.com/jnsahaj/tweakcn).
 * Data only: names, rows, values. No judgement lives in this file.
 */

// Catalogue filenames as shipped by `shadcn add --all` (61 as of 2026-09),
// plus the older names still found in installs from before 2025. Used only to
// recognise a vendored folder, never to judge one.
export const CATALOGUE = new Set(['accordion', 'alert-dialog', 'alert', 'aspect-ratio', 'attachment',
  'avatar', 'badge', 'breadcrumb', 'bubble', 'button-group', 'button', 'calendar', 'card', 'carousel',
  'chart', 'checkbox', 'collapsible', 'combobox', 'command', 'context-menu', 'dialog', 'direction',
  'drawer', 'dropdown-menu', 'empty', 'field', 'hover-card', 'input-group', 'input-otp', 'input',
  'item', 'kbd', 'label', 'marker', 'menubar', 'message-scroller', 'message', 'native-select',
  'navigation-menu', 'pagination', 'popover', 'progress', 'questionnaire', 'radio-group', 'resizable',
  'scroll-area', 'select', 'separator', 'sheet', 'sidebar', 'skeleton', 'slider', 'spinner', 'switch',
  'table', 'tabs', 'textarea', 'toast', 'toggle-group', 'toggle', 'tooltip',
  // older installs
  'form', 'sonner', 'toaster', 'use-toast']);

// Component files the block kits install into OWN code (login-form.tsx lands
// under the components alias, not under ui/). Kit doors stored outside the
// catalogue, judged like the catalogue.
export const BLOCK_COMPONENTS = new Set(['app-sidebar', 'calendars', 'chart-area-interactive',
  'data-table', 'date-picker', 'login-form', 'nav-actions', 'nav-documents', 'nav-favorites',
  'nav-main', 'nav-projects', 'nav-secondary', 'nav-user', 'nav-workspaces', 'prompt-input',
  'search-form', 'section-cards', 'settings-dialog', 'sidebar-left', 'sidebar-opt-in-form',
  'sidebar-right', 'signup-form', 'site-header', 'team-switcher', 'version-switcher']);

// Third-party registries that install through the shadcn CLI into a folder of
// their own under the components alias (ai-elements from Vercel, kibo-ui,
// magicui, motion-primitives...). Installed code the team did not write,
// judged like the catalogue. Folder names as the CLI creates them; a
// components.json `registries` key ("@kibo-ui") adds its own name at scan.
export const REGISTRY_DIRS = new Set(['ai-elements', 'kibo-ui', 'magicui', 'magic-ui', 'aceternity',
  'aceternity-ui', 'originui', 'origin-ui', 'cult-ui', 'motion-primitives', 'animate-ui', 'tailark',
  'shadcn-blocks', 'skiper-ui', 'react-bits', 'eldora-ui', 'cuicui', 'spectrum-ui']);

// The sheet: rows shadcn's theming docs define, each in :root and .dark.
export const SHADCN_ROWS = ['background', 'foreground', 'card', 'card-foreground', 'popover',
  'popover-foreground', 'primary', 'primary-foreground', 'secondary', 'secondary-foreground',
  'muted', 'muted-foreground', 'accent', 'accent-foreground', 'destructive', 'border', 'input',
  'ring', 'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'sidebar', 'sidebar-foreground',
  'sidebar-primary', 'sidebar-primary-foreground', 'sidebar-accent', 'sidebar-accent-foreground',
  'sidebar-border', 'sidebar-ring', 'radius'];

// Rows tweakcn adds to every theme it exports.
export const TWEAKCN_ROWS = ['destructive-foreground', 'font-sans', 'font-serif', 'font-mono',
  'shadow-2xs', 'shadow-xs', 'shadow-sm', 'shadow', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl',
  'shadow-color', 'shadow-opacity', 'shadow-blur', 'shadow-spread', 'shadow-offset-x', 'shadow-offset-y',
  'tracking-tighter', 'tracking-tight', 'tracking-normal', 'tracking-wide', 'tracking-wider',
  'tracking-widest', 'spacing'];

// Rows the docs or the shipped agent skill mention beyond the two lists.
export const OTHER_KNOWN_ROWS = ['font-heading', 'surface', 'surface-foreground',
  'sidebar-background', 'destructive-foreground', 'radius-sm', 'radius-md', 'radius-lg',
  'radius-xl', 'radius-2xl', 'radius-3xl', 'radius-4xl'];

export const KNOWN_ROWS = new Set([...SHADCN_ROWS, ...TWEAKCN_ROWS, ...OTHER_KNOWN_ROWS]);

// Rows that only exist once (no evening value expected).
export const LIGHT_ONLY_ROWS = new Set(['radius', 'spacing', 'font-sans', 'font-serif', 'font-mono',
  'font-heading', 'tracking-tighter', 'tracking-tight', 'tracking-normal', 'tracking-wide',
  'tracking-wider', 'tracking-widest', 'radius-sm', 'radius-md', 'radius-lg', 'radius-xl',
  'radius-2xl', 'radius-3xl', 'radius-4xl', 'shadow-2xs', 'shadow-xs', 'shadow-sm', 'shadow',
  'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl', 'shadow-color', 'shadow-opacity',
  'shadow-blur', 'shadow-spread', 'shadow-offset-x', 'shadow-offset-y']);

// The factory value of the gap multiplier. Changing it moves every gap in the
// kitchen at once; shadcn's own changelog (Rhea, 2026-05) says not to.
export const FACTORY_SPACING = '0.25rem';

// The kit vocabulary, from packages/shadcn/src/preset/preset.ts, with the
// legacy values still found in the fleet (slate and gray base colours, the
// pre-create fronts).
export const FRONTS = ['nova', 'vega', 'maia', 'lyra', 'mira', 'luma', 'sera', 'rhea'];
export const LEGACY_FRONTS = ['new-york', 'new-york-v4', 'default'];
export const BASES = ['base', 'radix', 'aria'];
export const BASE_COLORS = ['neutral', 'stone', 'zinc', 'gray', 'mauve', 'olive', 'mist', 'taupe', 'slate'];
export const ICON_LIBRARIES = ['lucide', 'hugeicons', 'tabler', 'phosphor', 'remixicon', 'radix'];
export const RADIUS_MAP = { '0': 'none', '0rem': 'none', '0px': 'none', '0.45rem': 'small',
  '0.5rem': 'legacy default', '0.625rem': 'default', '0.875rem': 'large' };

// Light-mode `--primary` and `--chart-2` per named theme, from
// apps/v4/registry/themes.ts. The accent is matched by primary, the chart
// colour by chart-2. A sheet in the v3 hsl form never matches, by design.
export const THEMES = [
  { name: 'neutral', primary: 'oklch(0.205 0 0)', chart2: 'oklch(0.556 0 0)' },
  { name: 'stone', primary: 'oklch(0.216 0.006 56.043)', chart2: 'oklch(0.553 0.013 58.071)' },
  { name: 'zinc', primary: 'oklch(0.21 0.006 285.885)', chart2: 'oklch(0.552 0.016 285.938)' },
  { name: 'mauve', primary: 'oklch(0.212 0.019 322.12)', chart2: 'oklch(0.542 0.034 322.5)' },
  { name: 'olive', primary: 'oklch(0.228 0.013 107.4)', chart2: 'oklch(0.58 0.031 107.3)' },
  { name: 'mist', primary: 'oklch(0.218 0.008 223.9)', chart2: 'oklch(0.56 0.021 213.5)' },
  { name: 'taupe', primary: 'oklch(0.214 0.009 43.1)', chart2: 'oklch(0.547 0.021 43.1)' },
  { name: 'amber', primary: 'oklch(0.555 0.163 48.998)', chart2: 'oklch(0.769 0.188 70.08)' },
  { name: 'blue', primary: 'oklch(0.488 0.243 264.376)', chart2: 'oklch(0.623 0.214 259.815)' },
  { name: 'cyan', primary: 'oklch(0.52 0.105 223.128)', chart2: 'oklch(0.715 0.143 215.221)' },
  { name: 'emerald', primary: 'oklch(0.508 0.118 165.612)', chart2: 'oklch(0.696 0.17 162.48)' },
  { name: 'fuchsia', primary: 'oklch(0.518 0.253 323.949)', chart2: 'oklch(0.667 0.295 322.15)' },
  { name: 'green', primary: 'oklch(0.527 0.154 150.069)', chart2: 'oklch(0.723 0.219 149.579)' },
  { name: 'indigo', primary: 'oklch(0.457 0.24 277.023)', chart2: 'oklch(0.585 0.233 277.117)' },
  { name: 'lime', primary: 'oklch(0.841 0.238 128.85)', chart2: 'oklch(0.768 0.233 130.85)' },
  { name: 'orange', primary: 'oklch(0.553 0.195 38.402)', chart2: 'oklch(0.705 0.213 47.604)' },
  { name: 'pink', primary: 'oklch(0.525 0.223 3.958)', chart2: 'oklch(0.656 0.241 354.308)' },
  { name: 'purple', primary: 'oklch(0.496 0.265 301.924)', chart2: 'oklch(0.627 0.265 303.9)' },
  { name: 'red', primary: 'oklch(0.505 0.213 27.518)', chart2: 'oklch(0.637 0.237 25.331)' },
  { name: 'rose', primary: 'oklch(0.514 0.222 16.935)', chart2: 'oklch(0.645 0.246 16.439)' },
  { name: 'sky', primary: 'oklch(0.5 0.134 242.749)', chart2: 'oklch(0.685 0.169 237.323)' },
  { name: 'teal', primary: 'oklch(0.511 0.096 186.391)', chart2: 'oklch(0.704 0.14 182.503)' },
  { name: 'violet', primary: 'oklch(0.491 0.27 292.581)', chart2: 'oklch(0.606 0.25 292.717)' },
  { name: 'yellow', primary: 'oklch(0.681 0.162 75.834)', chart2: 'oklch(0.795 0.184 86.047)' },
];

// Tailwind's named palette: paint from a tin when it appears in own code.
export const PALETTE = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
