/**
 * Honesty exemptions — the two places where styling genuinely cannot be
 * on-system, so judging it would be crying wolf.
 *
 * Email and print: mail clients strip stylesheets and print has no cascade to
 * inherit, so the styling has to be inline and hardcoded. That is the medium,
 * not a lapse.
 *
 * Artwork: a file named Icon, Logo, Badge or Illustration carries the colours
 * of the drawing itself, and a drawing is not interface. The name alone is not
 * enough though, or every Badge component would walk free: the contents must
 * actually draw SVG. A Badge that is plain styled UI gets judged like anything
 * else. A file that is mostly SVG earns it on contents alone, whatever it is
 * called.
 *
 * Render-to-image: an OG card or a PDF invoice is a picture drawn with code.
 * satori and react-pdf accept nothing but inline styles, so there is no
 * on-system way to write one.
 *
 * Renderers: a canvas or scene renderer draws pixels. Its colour literals are
 * the picture, not the product's palette.
 *
 * Shared by the engine (whole files) and by guard-my-design-system (added
 * lines), so both give the same answer about the same file.
 */
export const EMAIL_PRINT_RE = /email|(^|[/.])print([/.]|$)/i;
// Next.js's crash page replaces the root layout, so the app's stylesheet
// never loads there: Next.js tells developers to build it self-contained,
// styling written on the elements. The medium, not a lapse (2026-09-13).
export const CRASH_PAGE_RE = /(^|\/)global-error\.(tsx|jsx)$/;
export const ARTWORK_NAME_RE = /(^|\/)[\w.-]*(icon|logo|badge|illustration|shield|artwork|graphic|background)[\w.-]*\.(tsx|jsx)$/i;
export const SVG_MARKUP_RE = /<(svg|path|rect|circle|ellipse|polygon|defs|mask)\b/i;
export const RENDER_TO_IMAGE_RE = /ImageResponse|from ['"]satori['"]|from ['"]@react-pdf|next\/og/;
export const OG_ROUTE_RE = /(^|\/)api\/og\//;
export const RENDERER_PATH_RE = /(^|\/)(renderers?|scene|canvas)\/|renderElement|DebugCanvas/i;

/** Mostly drawing rather than styling, whatever the file is called. */
export const svgHeavy = (text) =>
  (text.match(/<(?:svg|path|rect|circle|ellipse|polygon|mask|defs)\b/g) ?? []).length >= 15;

/**
 * Why this file is exempt from judgement, as a sentence, or null when it is
 * fair game. Needs the text as well as the name: the artwork exemption is
 * earned by drawing, not by being called Icon.
 */
export function exemptReason(file, text = '') {
  if (!file) return null;
  if (EMAIL_PRINT_RE.test(file)) return 'email and print styling has to be inline, because there is no cascade to inherit';
  if (CRASH_PAGE_RE.test(file)) return 'the crash page replaces the root layout, so the stylesheet never loads there and its styling has to be inline';
  if (RENDERER_PATH_RE.test(file)) return 'a renderer draws pixels, so its colours are the picture rather than the interface';
  if (OG_ROUTE_RE.test(file) || RENDER_TO_IMAGE_RE.test(text)) return 'a render-to-image surface accepts nothing but inline styling, so there is no on-system way to write one';
  if (svgHeavy(text)) return 'the file is mostly drawing rather than styling';
  if (ARTWORK_NAME_RE.test(file) && SVG_MARKUP_RE.test(text)) return 'the colours belong to the artwork, not to the interface';
  return null;
}
