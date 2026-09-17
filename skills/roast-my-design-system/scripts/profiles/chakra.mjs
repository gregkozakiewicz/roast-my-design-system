/**
 * The chakra profile: a product built on Chakra UI, v2 or v3. The theme is
 * extendTheme() (v2) or createSystem(defaultConfig, defineConfig()) with
 * recipes (v3). Components read it through style props: color="fg.muted",
 * bg="gray.100", p={3}. In Chakra a number is a step of the space scale
 * (p={3} is 12px on the default theme), so a number is on-system and a pixel
 * string (p="12px") is not.
 *
 * Probe, 6 Chakra products (2026-09-17): FastGPT writes 3,704 numeric spacing
 * props and 104 pixel strings; Blockscout writes pixel strings only, mostly
 * odd sizes (py="7px").
 */
import { kitProfile } from './kit-common.mjs';

export const CHAKRA = {
  name: 'Chakra',
  kind: 'chakra',
  packages: ['@chakra-ui/react'],
  importRe: /from\s+['"]@chakra-ui\/|require\(\s*['"]@chakra-ui\//,
  reexportRe: /export\s+(?:\*|\{[^}]*\})\s+from\s+['"]@chakra-ui\//,
  // v2 extendTheme and style configs, v3 createSystem, defineConfig and recipes
  themeRe: /\b(?:extendTheme|createSystem|defineConfig|defineRecipe|defineSlotRecipe|defineStyleConfig|defineMultiStyleConfig|createMultiStyleConfigHelpers|defineTokens|defineSemanticTokens|defineStyle)\s*\(|<ChakraProvider[^>]*\btheme=\{/,
  themeImportRe: /from\s*['"]@chakra-ui\/(?:react|theme-tools|styled-system|theme)['"]/,
  // a theme that replaces the space scale makes a step something else
  spacingCustomRe: /\b(?:space|spacing)\s*:\s*\{/,
  refRe: /['"`](?:gray|red|orange|yellow|green|teal|blue|cyan|purple|pink|brand|primary|secondary|accent|whiteAlpha|blackAlpha)\.\d{2,3}['"`]|['"`](?:fg|bg|border|colorPalette)(?:\.[a-z]+)?['"`]|\buseColorModeValue\(|\btoken\(\s*['"`]|var\(--chakra-/g,
  advice: {
    themeCall: 'extendTheme() (v2) or createSystem() (v3)',
    refExamples: '<code>color="fg.muted"</code>, <code>bg="gray.100"</code> and <code>p={3}</code>',
    colourHow: 'On a Chakra component, point at it: <code>color="fg.muted"</code> or <code>bg="gray.100"</code> as a prop, <code>token("colors.gray.100")</code> in code. A colour that changes with the mode is a semantic token (v3) or <code>useColorModeValue</code> (v2), never a ternary on the mode.',
    spacingHow: (k) => (k.spacingUnit === 'custom'
      ? "This theme replaces Chakra's space scale, so a step is not the default size: convert only after checking the theme's space tokens, and leave the rest."
      : 'In Chakra a number is a step of the space scale: <code>p={3}</code> is 12px on the default theme. A pixel value that is a multiple of 4 is that step (12px is 3), and 2px, 6px, 10px and 14px are 0.5, 1.5, 2.5 and 3.5; any other size stays.'),
    rulesTheme: (file) => `Colours, spacing and radius are decided in \`${file}\`. On a component, use style props by name: \`color="fg.muted"\`, \`bg="gray.100"\`, \`p={3}\`, \`gap={2}\`; a colour that changes with the mode is a semantic token or \`useColorModeValue\`.`,
    rulesSpacing: 'Use space steps as numbers (`p={3}`), not pixel strings (`p="12px"`)',
    promptColour: '- Read the theme where Chakra reads it: style props with token names (color="fg.muted", bg="gray.100"), token() in code. Never import the theme file into a component just to read a hex.',
    promptSpacing: "- A number in a Chakra style prop is a space step, not pixels: 12px is p={3} only if the theme keeps Chakra's default space scale. Check the theme first.\n- Inside style={{}} or on a plain element a bare number is pixels. To use a step there, make the element a Chakra one (<Box as=\"legend\" ml={2}>) rather than changing the number.",
    promptInline: '- Move a style to Chakra style props (p={3}, color="fg.muted") only on Chakra components or wrappers that pass their props to one. Your own wrappers that take a style prop keep style.',
  },
};

export default kitProfile(CHAKRA);
