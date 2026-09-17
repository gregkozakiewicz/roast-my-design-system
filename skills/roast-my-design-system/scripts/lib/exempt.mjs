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
// An email built with an email kit is an email wherever it lives: react-email
// keeps 75 templates in folders like two-buttons/ (2026-09-16).
export const EMAIL_KIT_RE = /from\s+['"](?:react-email|@react-email\/[\w-]+|jsx-email|@jsx-email\/[\w-]+|mjml-react|@faire\/mjml-react)['"]/;
// Next.js's crash page replaces the root layout, so the app's stylesheet
// never loads there: Next.js tells developers to build it self-contained,
// styling written on the elements. The medium, not a lapse (2026-09-13).
export const CRASH_PAGE_RE = /(^|\/)global-error\.(tsx|jsx)$/;
export const ARTWORK_NAME_RE = /(^|\/)[\w.-]*(icon|logo|badge|illustration|shield|artwork|graphic|background)[\w.-]*\.(tsx|jsx)$/i;
export const SVG_MARKUP_RE = /<(svg|path|rect|circle|ellipse|polygon|defs|mask)\b/i;
// A picture drawn from the DOM (a shareable card, a receipt) is the same
// medium: the tool reads the styling off the element (2026-09-17).
export const RENDER_TO_IMAGE_RE = /ImageResponse|from ['"]satori['"]|from ['"]@react-pdf|next\/og|from ['"](?:html-to-image|html2canvas(?:-pro)?|dom-to-image(?:-more)?|modern-screenshot)['"]/;
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
  if (EMAIL_PRINT_RE.test(file) || EMAIL_KIT_RE.test(text)) return 'email and print styling has to be inline, because there is no cascade to inherit';
  if (CRASH_PAGE_RE.test(file)) return 'the crash page replaces the root layout, so the stylesheet never loads there and its styling has to be inline';
  if (RENDERER_PATH_RE.test(file)) return 'a renderer draws pixels, so its colours are the picture rather than the interface';
  if (OG_ROUTE_RE.test(file) || RENDER_TO_IMAGE_RE.test(text)) return 'a render-to-image surface accepts nothing but inline styling, so there is no on-system way to write one';
  if (svgHeavy(text)) return 'the file is mostly drawing rather than styling';
  if (ARTWORK_NAME_RE.test(file) && SVG_MARKUP_RE.test(text)) return 'the colours belong to the artwork, not to the interface';
  return null;
}

/**
 * A stylesheet the team did not write: a library's CSS copied into the repo
 * (Percona keeps Swagger UI's, Stirling-PDF and HyperDX keep Bootstrap's), CSS
 * a browser extension injects into other people's pages, and a code or
 * markdown theme, which styles content rather than the product's interface.
 * Named in the report and left out of the counts (2026-09-17).
 */
export const VENDOR_CSS_NAME_RE = /(^|\/)_?(?:swagger-ui|bootstrap(?:-theme|-utilities|-grid|-reboot)?|normalize|font-?awesome|semantic(?:-ui)?|foundation|bulma|materialize|quill(?:\.\w+)?|katex|leaflet|mapbox-gl|maplibre-gl|photoswipe|slick(?:-theme)?|flatpickr|tippy|swiper)(?:\.min)?\.(?:css|scss|less)$/i;
export const CONTENT_CSS_NAME_RE = /(^|\/)_?(?:highlight(?:-\w+)?|hljs(?:-theme)?|prism(?:-\w+)?|shiki|github-markdown|markdown-body|code-theme|atom-one-\w+|monokai)(?:\.min)?\.(?:css|scss|less)$/i;
export const EXTENSION_CSS_PATH_RE = /(^|\/)(?:chrome-extension|browser-extension|webextension)\/[\s\S]*\/(?:content|inject)[\w-]*\.(?:css|scss|less)$|(^|\/)content[_-]?script[\w-]*\.(?:css|scss|less)$/i;
// minified: one very long line, whoever shipped it
export const minifiedCss = (text) => text.split('\n').some((l) => l.length > 2000);

/** Why this stylesheet is not the product's own, or null. */
export function foreignStylesheet(file, text = '') {
  // a CSS module is the team's own component styling, whatever it is called
  if (/\.module\.(?:css|scss|less)$/i.test(file)) return null;
  if (VENDOR_CSS_NAME_RE.test(file)) return "a library's stylesheet kept in the repo";
  if (minifiedCss(text)) return 'a minified stylesheet, shipped rather than written here';
  if (CONTENT_CSS_NAME_RE.test(file)) return 'a code or markdown theme: it styles content, not the interface';
  if (EXTENSION_CSS_PATH_RE.test(file)) return "CSS injected into other people's pages by a browser extension";
  return null;
}

/**
 * Class names a library ships and the team can only shout over: a code
 * editor, a date picker, a grid, an emoji picker, a docs theme. An !important
 * on a selector made only of these, none of which the team writes in its own
 * code, is the medium rather than the mess (fleet probe 2026-09-13: 30% of
 * all !important, the tile keeps its spread). Prefix match, by name, so the
 * report can say which library. Extend as the fleet shows new ones.
 */
export const LIBRARY_CLASS_RE = /^(ck$|cm-|ͼ|ProseMirror|monaco-|sp-|react-datepicker|react-tel-input|DateInput_|DayPicker|react-grid-|react-resizable|react-flow|react-select|react-toastify|Toastify|select2|EmojiPickerReact|epr-|notion-|fc-|fc$|tippy-|hljs|language-|ps__|ace_|ng-|docsearch|DocSearch|grecaptcha|rr-|sbdocs|docs-story|mapboxgl-|leaflet-|swiper-|slick-|rc-|ant-|Mui|ck-|ql-|tox-|mce-|DraftEditor|public-Draft|w-md-editor|rdp-|recharts-|apexcharts-|intercom-|crisp-|hubspot|shiki|katex|mermaid|prism-)/;
export const isLibraryClass = (c) => LIBRARY_CLASS_RE.test(c);

/**
 * An embedded widget (a survey, a chat bubble) lives inside a stranger's page
 * and must beat the host's CSS: Tailwind imported with the important flag, or
 * a config scoping every utility under an id. There, !important is the medium.
 */
export const WIDGET_CSS_RE = /@import\s+["']tailwindcss(?:\/utilities\.css)?["'][^;]*\bimportant\b/;
export const WIDGET_CONFIG_RE = /\bimportant\s*:\s*["']#/;
