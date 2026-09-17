/**
 * The mantine profile: a product built on Mantine. The theme is a
 * createTheme() call handed to <MantineProvider theme>; components read it
 * through props (c="dimmed", p="md", color="blue.6"), theme.colors in code
 * and var(--mantine-color-*) in CSS modules. What drifts is a hex written onto
 * a component, and spacing written as a number: in Mantine p={10} is ten
 * pixels, while p="md" is the theme's step.
 *
 * Probe, 5 Mantine products (2026-09-17): numeric spacing props are a fifth to
 * a third of all spacing props (Lightdash 1,083 of 4,251), so the count
 * separates a team that uses the scale from one that types numbers.
 */
import { kitProfile } from './kit-common.mjs';

const SPACING_PROPS = 'p|m|px|py|pt|pb|pl|pr|ps|pe|mx|my|mt|mb|ml|mr|ms|me|gap|rowGap|columnGap';

export const MANTINE = {
  name: 'Mantine',
  kind: 'mantine',
  packages: ['@mantine/core'],
  importRe: /from\s+['"]@mantine\/|require\(\s*['"]@mantine\//,
  themeRe: /\b(?:createTheme|mergeMantineTheme)\s*\(|<MantineProvider[^>]*\btheme=\{|:\s*MantineThemeOverride\b/,
  themeImportRe: /from\s*['"]@mantine\/core['"]/,
  refRe: /var\(--mantine-(?:color|spacing|radius|font-size|shadow)-|theme\.colors\.|theme\.spacing\.|theme\.radius\.|theme\.other\.|(?<![\w-])(?:c|color|bg)=["'](?:dimmed|bright|[a-z]+(?:\.\d)?)["']|(?<![\w-])(?:p|m|px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr|gap)=["'](?:xs|sm|md|lg|xl)["']/g,
  // p={10} and rem(10) in a spacing key are pixels in Mantine
  pxPropRes: [
    new RegExp(`(?<![\\w-])(${SPACING_PROPS})=\\{\\s*(\\d+(?:\\.\\d+)?)\\s*\\}`, 'g'),
    /\b(padding|margin|gap|paddingTop|paddingBottom|paddingLeft|paddingRight|paddingInline|paddingBlock|marginTop|marginBottom|marginLeft|marginRight|marginInline|marginBlock|rowGap|columnGap)\s*:\s*rem\(\s*(\d+(?:\.\d+)?)\s*\)/g,
  ],
  advice: {
    themeCall: 'createTheme()',
    refExamples: '<code>c="dimmed"</code>, <code>p="md"</code> and <code>var(--mantine-color-…)</code>',
    colourHow: 'On a Mantine component, point at it: <code>c="dimmed"</code> or <code>color="blue.6"</code> as a prop, <code>theme.colors.blue[6]</code> in code, <code>var(--mantine-color-blue-6)</code> in a CSS module.',
    spacingHow: () => 'In Mantine a number is pixels: <code>p={10}</code> is 10px, while <code>p="md"</code> is the theme\'s step. A spacing that matches a theme step becomes the step name (<code>xs</code> to <code>xl</code>); one that does not stays.',
    rulesTheme: (file) => `Colours, spacing and radius are decided in \`${file}\`. On a component, read them by name: \`c="dimmed"\`, \`color="blue.6"\`, \`p="md"\`, \`gap="sm"\`; in a CSS module, \`var(--mantine-spacing-md)\` and \`var(--mantine-color-blue-6)\`.`,
    rulesSpacing: 'Use the theme\'s spacing names (`p="md"`), not numbers (`p={10}` is pixels)',
    promptColour: '- Read the theme where Mantine reads it: color props (c="dimmed", color="blue.6"), theme.colors in code, var(--mantine-color-*) in CSS modules. Never import the theme file into a component just to read a hex.',
    promptSpacing: '- Check the theme\'s spacing sizes before converting: the defaults are xs 10px, sm 12px, md 16px, lg 20px, xl 32px, and a theme can change them. Convert only an exact match.',
    promptInline: '- Move a style to Mantine style props (p="md", c="dimmed") or a CSS module only on Mantine components or wrappers that pass their props to one. Your own wrappers that take a style prop keep style.',
  },
};

export default kitProfile(MANTINE);
