/**
 * The antd profile: a product built on Ant Design (v4 or v5). The v5 theme is
 * a design-token object handed to <ConfigProvider theme={{ token, components,
 * algorithm }}>; components read it through theme.useToken() (token.margin,
 * token.colorTextSecondary) or CSS variables (var(--ant-color-primary)). v4
 * teams set LESS variables instead, which the stylesheet tiles already read.
 *
 * Ant Design has no style props, so spacing is written in style objects,
 * where a React number is pixels: style={{ marginBottom: 16 }} is 16px, and
 * token.margin is the theme's 16.
 *
 * Probe, 6 Ant Design products (2026-09-17): NocoBase reads spacing tokens
 * 1,070 times next to 1,142 numbers; Superset writes 457 numbers and reads
 * 9 tokens. Redash and n9e style mostly in LESS (146 and 196 files).
 */
import { kitProfile } from './kit-common.mjs';

const SPACING_KEYS = 'margin|padding|gap|rowGap|columnGap|marginTop|marginBottom|marginLeft|marginRight|marginInline|marginBlock|marginInlineStart|marginInlineEnd|paddingTop|paddingBottom|paddingLeft|paddingRight|paddingInline|paddingBlock|paddingInlineStart|paddingInlineEnd';

export const ANTD = {
  name: 'Ant Design',
  kind: 'antd',
  packages: ['antd'],
  importRe: /from\s+['"]antd(?:\/[\w/-]+)?['"]|require\(\s*['"]antd['"/]/,
  reexportRe: /export\s+(?:\*|\{[^}]*\})\s+from\s+['"]antd['"/]/,
  // v5 ConfigProvider theme, a ThemeConfig object, or the theme algorithm
  themeRe: /<ConfigProvider[^>]*\btheme=\{|\bThemeConfig\b|\btheme\s*:\s*\{\s*(?:token|algorithm|components|cssVar|hashed)\b|\balgorithm\s*:\s*(?:\[|theme\.)/,
  themeImportRe: /from\s*['"]antd(?:\/[\w/-]+)?['"]/,
  refRe: /\btoken\.(?:color|padding|margin|size|borderRadius|fontSize|lineHeight|controlHeight|boxShadow|motion)\w*|\btheme\.useToken\(|\buseToken\(|var\(--ant-/g,
  // a number in a React style object is pixels
  pxPropRes: [new RegExp(`\\b(${SPACING_KEYS})\\s*:\\s*(\\d+(?:\\.\\d+)?)(?![\\w.%])`, 'g')],
  // paddingXXS is 4px; nothing smaller has a token
  pxMin: 4,
  advice: {
    themeCall: 'a theme object on ConfigProvider',
    refExamples: '<code>token.colorTextSecondary</code> and <code>token.margin</code> from <code>theme.useToken()</code>',
    colourHow: 'On an Ant Design component, read the token: <code>const { token } = theme.useToken()</code>, then <code>color: token.colorTextSecondary</code>, or <code>var(--ant-color-text-secondary)</code> in a stylesheet when CSS variables are on. A brand colour belongs in <code>ConfigProvider</code>\'s <code>token.colorPrimary</code>.',
    spacingHow: () => 'In a React style object a number is pixels: <code>marginBottom: 16</code> is 16px. Read the spacing tokens instead: <code>token.marginXS</code> 8, <code>token.marginSM</code> 12, <code>token.margin</code> 16, <code>token.marginLG</code> 24, <code>token.marginXL</code> 32, and the same for padding (<code>token.paddingXXS</code> is 4). A size that matches a token becomes the token; one that does not stays.',
    rulesTheme: (file) => `Colours, spacing and radius are decided in the theme handed to ConfigProvider (\`${file}\`). In a component, read them with \`theme.useToken()\`: \`token.colorTextSecondary\`, \`token.margin\`, \`token.borderRadius\`; for layout between components use \`<Space size="middle">\` or \`<Flex gap="small">\`.`,
    rulesSpacing: 'Use the spacing tokens (`token.margin`, `token.paddingSM`), not numbers in style objects',
    promptColour: '- Read the theme where Ant Design reads it: theme.useToken() in components, var(--ant-*) in stylesheets when CSS variables are on. A colour Ant Design has no token for goes into ConfigProvider\'s token object once, not into the component.',
    promptSpacing: '- The token values above are the defaults; check the ConfigProvider theme for overrides (token.sizeUnit, token.margin) before converting. Convert only an exact match.\n- Space and Flex take size and gap as "small", "middle", "large"; prefer those for gaps between components.',
    promptInline: '- An Ant Design component has no style props: keep static styles in a stylesheet or a CSS-in-JS style that reads the token, and keep style={{}} for values computed at runtime. Your own wrappers that take a style prop keep style.',
  },
};

export default kitProfile(ANTD);
