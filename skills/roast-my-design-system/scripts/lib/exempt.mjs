/**
 * Honesty exemptions — the two places where styling genuinely cannot be
 * on-system, so judging it would be crying wolf.
 *
 * Email and print: mail clients strip stylesheets and print has no cascade to
 * inherit, so the styling has to be inline and hardcoded. That is the medium,
 * not a lapse. A screen ABOUT email is not an email, though: a sign-in form,
 * the email settings, an inbox. Until 9.2.3 any path with "email" in it was
 * skipped, and an email client (inbox-zero keeps its whole app under
 * [emailAccountId]/) went unjudged. Now a file is an email when it shows it:
 * see isEmail below.
 *
 * Artwork: a file named Icon, Logo, Badge or Illustration carries the colours
 * of the drawing itself, and a drawing is not interface. The name alone is not
 * enough though, or every Badge component would walk free: the contents must
 * actually draw SVG. A Badge that is plain styled UI gets judged like anything
 * else. A file that is mostly SVG earns it on contents alone, whatever it is
 * called. So does a file that draws SVG inside an icons, logos or
 * illustrations folder: an icon set names its files after what they show
 * (ActionSendEmail.tsx, Server.tsx), not after being an icon.
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
// Where an email or a print stylesheet may live: a path that mentions either.
// A candidate only; isEmail decides.
export const EMAIL_PRINT_RE = /email|(^|[/.])print([/.]|$)/i;
const PRINT_RE = /(^|[/.])print([/.]|$)/i;
// An email built with an email kit is an email wherever it lives: react-email
// keeps 75 templates in folders like two-buttons/ (2026-09-16).
export const EMAIL_KIT_RE = /from\s+['"](?:react-email|@react-email\/[\w-]+|jsx-email|@jsx-email\/[\w-]+|mjml-react|@faire\/mjml-react)['"]/;
// Markup only an email carries, or a page sent outside the app: MJML, Outlook
// conditionals, the old table attributes, react-email's roots, and an HTML
// style="" attribute written as text, which JSX cannot hold (a server that
// builds its emails as strings: lobe-chat, Ghost, novu).
export const EMAIL_MARKUP_RE = /<mj-|mso-|<!--\[if|\bcellpadding=|\bcellspacing=|\bbgcolor=|<Html[\s>]|<Body[\s>]|\bstyle\s*=\s*\\?["'][^"'{}]*:[^"']*["']/i;
// A folder named for email: email, emails, email-templates, twenty-emails,
// email_service. Not [emailAccountId], which is a route holding an app.
const EMAIL_FOLDER_RE = /^(?:[a-z0-9]+[-_.])*emails?(?:[-_.][a-z0-9]+)*$/i;
// Email templates written in a template language rather than code
const EMAIL_TEMPLATE_FILE_RE = /\.(hbs|handlebars|mjml|njk|ejs|pug|liquid|mustache|html)$/i;
// A preview of an email draws the email's colours, not the product's
const EMAIL_PREVIEW_RE = /(e?mail|newsletter).*(preview|frame)|(preview|frame).*(e?mail|newsletter)/i;
// A stylesheet written for emails: email.css, emails.scss, email-pdf-styles.css
const EMAIL_SHEET_RE = /^e?mails?(?:[-_.][a-z0-9-]+)*\.(css|scss|sass|less)$/i;
const base = (f) => f.slice(f.lastIndexOf('/') + 1);
const dir = (f) => (f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '');

/**
 * Where the repo keeps its emails, read once per scan: `homes` are folders
 * named for email that hold an email template (a code file with an email kit
 * or email markup, or a template-language file), and `templateDirs` are the
 * folders the templates sit in. A template that builds on the team's own
 * layout (twenty's billing emails import their BaseEmail) carries no kit
 * itself; its home says what it is.
 * @param files  the walk's { code, other } (repo-relative paths)
 * @param read   (file) => text or null
 */
export function emailContextOf(files, read) {
  const templates = [];
  for (const f of [...(files.code ?? []), ...(files.other ?? [])]) {
    if (!/email/i.test(f)) continue;
    if (EMAIL_TEMPLATE_FILE_RE.test(f)) { templates.push(f); continue; }
    if (!/\.(tsx|jsx|js|ts|mjs|cjs)$/.test(f)) continue;
    const t = read(f) ?? '';
    if (EMAIL_KIT_RE.test(t) || EMAIL_MARKUP_RE.test(t)) templates.push(f);
  }
  const homes = new Set();
  for (const f of templates) {
    const parts = f.split('/');
    for (let i = 1; i < parts.length; i++) if (EMAIL_FOLDER_RE.test(parts[i - 1])) homes.add(parts.slice(0, i).join('/'));
  }
  return { homes: [...homes].sort(), templateDirs: [...new Set(templates.map(dir))].sort() };
}

/**
 * Whether a file is an email or a print stylesheet. A path that mentions
 * email is only a candidate: the file has to show it, by its kit, its markup,
 * the email folder it sits in, being a preview of an email or a stylesheet
 * written for one, or an email-named file beside the templates it sends
 * (Ghost's gift-email-service.ts next to its .hbs files).
 * @param email  emailContextOf's answer for this repo; without it, only what
 *               the file shows by itself counts
 */
export function isEmail(file, text = '', email = null) {
  if (!file) return false;
  if (PRINT_RE.test(file) || EMAIL_KIT_RE.test(text)) return true;
  if (!/email/i.test(file)) return false;
  if (EMAIL_MARKUP_RE.test(text)) return true;
  const name = base(file);
  if (EMAIL_PREVIEW_RE.test(name) || EMAIL_SHEET_RE.test(name)) return true;
  if (!email) return false;
  if (email.homes.some((h) => file.startsWith(`${h}/`))) return true;
  const here = dir(file);
  return /e?mail/i.test(name) && email.templateDirs.some((d) => d === here || dir(d) === here);
}
// Next.js's crash page replaces the root layout, so the app's stylesheet
// never loads there: Next.js tells developers to build it self-contained,
// styling written on the elements. The medium, not a lapse (2026-09-13).
export const CRASH_PAGE_RE = /(^|\/)global-error\.(tsx|jsx)$/;
export const ARTWORK_NAME_RE = /(^|\/)[\w.-]*(icon|logo|badge|illustration|shield|artwork|graphic|background)[\w.-]*\.(tsx|jsx)$/i;
export const SVG_MARKUP_RE = /<(svg|path|rect|circle|ellipse|polygon|defs|mask)\b/i;
// An icon set's folder. Measured on 205 repos (2026-09-30): 1,252 files freed
// in 20 repos, every one an icon, a logo or a loader; none held state or a
// click handler. teable fell 28 to 24: its 250 icons had padded the files
// that the per-100-files rates divide by.
export const ARTWORK_DIR_RE = /(^|\/)(icons?|logos?|illustrations?)\//i;
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
 * earned by drawing, not by being called Icon, and the email one by being an
 * email, not by mentioning one.
 * @param email  emailContextOf's answer for this repo (see isEmail)
 */
export function exemptReason(file, text = '', { email = null } = {}) {
  if (!file) return null;
  if (isEmail(file, text, email)) return 'email and print styling has to be inline, because there is no cascade to inherit';
  if (CRASH_PAGE_RE.test(file)) return 'the crash page replaces the root layout, so the stylesheet never loads there and its styling has to be inline';
  if (RENDERER_PATH_RE.test(file)) return 'a renderer draws pixels, so its colours are the picture rather than the interface';
  if (OG_ROUTE_RE.test(file) || RENDER_TO_IMAGE_RE.test(text)) return 'a render-to-image surface accepts nothing but inline styling, so there is no on-system way to write one';
  if (svgHeavy(text)) return 'the file is mostly drawing rather than styling';
  if ((ARTWORK_NAME_RE.test(file) || ARTWORK_DIR_RE.test(file)) && SVG_MARKUP_RE.test(text)) return 'the colours belong to the artwork, not to the interface';
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
// Tailwind's own build output, committed: it opens with the licence banner and
// restates every --tw-* internal. Cal.com keeps a 343 KB one, pretty-printed so
// the minified test misses it, and until 8.6.2 the twin check paired a new
// theme token with --tw-ring-offset-color from it (benchmark, 2026-09-25).
export const COMPILED_TAILWIND_RE = /^\s*\/\*!\s*tailwindcss v\d/;

/** Why this stylesheet is not the product's own, or null. */
export function foreignStylesheet(file, text = '') {
  // a CSS module is the team's own component styling, whatever it is called
  if (/\.module\.(?:css|scss|less)$/i.test(file)) return null;
  if (VENDOR_CSS_NAME_RE.test(file)) return "a library's stylesheet kept in the repo";
  if (minifiedCss(text)) return 'a minified stylesheet, shipped rather than written here';
  if (COMPILED_TAILWIND_RE.test(text)) return "Tailwind's compiled output, generated from the source rather than written here";
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
