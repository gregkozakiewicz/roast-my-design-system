/**
 * One colour parser for every module that needs to reason about a colour
 * (greys, luminance, near-identical twins, nearest-token snapping). Until
 * 5.10.0 all of that understood hex only, so an oklch or hsl palette (every
 * shadcn repo) reported 0 greys and 0 twins no matter what it held.
 *
 * parseColor(value) → { r, g, b, a } with channels 0-255 (fractional allowed)
 * and alpha 0-1, or null when the value is not a literal colour. var() refs,
 * currentColor and the like are never colours here: the harvest owns that
 * decision, this module only converts what it is handed.
 *
 * Deterministic on purpose: plain arithmetic, no Intl, no locale, no rounding
 * that depends on the platform. Same input, same output, every machine.
 */

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const num = (s) => parseFloat(s);
const pct = (s, max = 1) => (s.endsWith('%') ? (num(s) / 100) * max : num(s));

function hueToDeg(s) {
  const v = num(s);
  if (/turn$/.test(s)) return v * 360;
  if (/rad$/.test(s)) return (v * 180) / Math.PI;
  if (/grad$/.test(s)) return v * 0.9;
  return v;
}

function hslToRgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

// Linear sRGB → gamma-encoded sRGB (0-1).
const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

// OKLab → linear sRGB (Björn Ottosson's published matrices).
function oklabToLinear(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

// CIELAB (D65) → linear sRGB.
function labToLinear(L, a, b) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const finv = (t) => (t > 6 / 29 ? t * t * t : 3 * (6 / 29) * (6 / 29) * (t - 4 / 29));
  const X = 0.95047 * finv(fx), Y = 1.0 * finv(fy), Z = 1.08883 * finv(fz);
  return [
    3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z,
    -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z,
    0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z,
  ];
}

const to255 = ([r, g, b]) => [clamp01(r) * 255, clamp01(g) * 255, clamp01(b) * 255];

/** Split "a, b, c / d" or "a b c / d" into channel strings plus alpha string. */
function channels(inner, lead = 0) {
  const [main, alphaPart] = inner.split('/').map((s) => s.trim());
  const parts = main.split(/[\s,]+/).filter(Boolean);
  let alpha = alphaPart;
  // Legacy comma syntax carries alpha as a 4th channel (rgba(0,0,0,.5));
  // color() leads with a space name, so its 4th part is the third channel.
  if (!alpha && parts.length === 4 + lead) alpha = parts.pop();
  return { parts, alpha };
}

export function parseColor(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (!v || v.includes('var(')) return null;

  const hex = /^#([0-9a-f]{3,8})$/.exec(v);
  if (hex) {
    let x = hex[1];
    if (x.length === 3 || x.length === 4) x = [...x].map((c) => c + c).join('');
    if (x.length !== 6 && x.length !== 8) return null;
    return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16),
      a: x.length === 8 ? parseInt(x.slice(6, 8), 16) / 255 : 1 };
  }

  const fn = /^([a-z-]+)\(\s*(.+?)\s*\)$/.exec(v);
  if (!fn) return null;
  const name = fn[1];
  const { parts, alpha } = channels(fn[2], name === 'color' ? 1 : 0);
  const numeric = (p) => /^-?[\d.]+(?:%|deg|turn|rad|grad)?$/.test(p) || p === 'none';
  // color() leads with a space name; every other function is channels only.
  if (parts.length < 3 || parts.slice(name === 'color' ? 1 : 0).some((p) => !numeric(p))) return null;
  const P = parts.map((p) => (p === 'none' ? '0' : p));
  const a = alpha === undefined || alpha === 'none' ? 1 : clamp01(pct(alpha));
  let rgb;
  switch (name) {
    case 'rgb': case 'rgba':
      rgb = P.slice(0, 3).map((p) => (p.endsWith('%') ? pct(p) * 255 : num(p)));
      return { r: rgb[0], g: rgb[1], b: rgb[2], a };
    case 'hsl': case 'hsla':
      rgb = to255(hslToRgb(hueToDeg(P[0]), clamp01(pct(P[1])), clamp01(pct(P[2]))));
      break;
    case 'oklch': {
      const L = P[0].endsWith('%') ? pct(P[0]) : num(P[0]);
      const C = P[1].endsWith('%') ? pct(P[1], 0.4) : num(P[1]);
      const H = (hueToDeg(P[2]) * Math.PI) / 180;
      rgb = to255(oklabToLinear(L, C * Math.cos(H), C * Math.sin(H)).map(gamma));
      break;
    }
    case 'oklab': {
      const L = P[0].endsWith('%') ? pct(P[0]) : num(P[0]);
      const A = P[1].endsWith('%') ? pct(P[1], 0.4) : num(P[1]);
      const B = P[2].endsWith('%') ? pct(P[2], 0.4) : num(P[2]);
      rgb = to255(oklabToLinear(L, A, B).map(gamma));
      break;
    }
    case 'lab': {
      const L = P[0].endsWith('%') ? pct(P[0], 100) : num(P[0]);
      const A = P[1].endsWith('%') ? pct(P[1], 125) : num(P[1]);
      const B = P[2].endsWith('%') ? pct(P[2], 125) : num(P[2]);
      rgb = to255(labToLinear(L, A, B).map(gamma));
      break;
    }
    case 'lch': {
      const L = P[0].endsWith('%') ? pct(P[0], 100) : num(P[0]);
      const C = P[1].endsWith('%') ? pct(P[1], 150) : num(P[1]);
      const H = (hueToDeg(P[2]) * Math.PI) / 180;
      rgb = to255(labToLinear(L, C * Math.cos(H), C * Math.sin(H)).map(gamma));
      break;
    }
    case 'color': {
      // color(srgb r g b) and the wide-gamut spaces, treated as sRGB: the
      // difference is far below the twin threshold and grey rule.
      const space = P[0];
      if (!/^(srgb|srgb-linear|display-p3|a98-rgb|prophoto-rgb|rec2020)$/.test(space) || P.length < 4) return null;
      const c = P.slice(1, 4).map((p) => clamp01(pct(p)));
      rgb = to255(space === 'srgb-linear' ? c.map(gamma) : c);
      break;
    }
    default:
      return null;
  }
  return { r: rgb[0], g: rgb[1], b: rgb[2], a };
}

/** Relative luminance-ish weight on 0-255 channels, matching the report's grey ramp. */
export const luminance = ({ r, g, b }) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * A grey is an opaque colour whose channels sit within 10 of each other.
 * Opaque on purpose: rgba(0,0,0,.12) and its eleven alpha siblings are
 * overlays and shadows, a different phenomenon from the neutral ramp the
 * grey tile measures (excalidraw carries 27 of them; counting them as greys
 * turned a 44-grey repo into a 71-grey one overnight). They still count as
 * colours, strays and twins; they just do not climb the grey ladder.
 */
export function isGrey(value) {
  const c = parseColor(value);
  return !!c && c.a >= 0.99 && Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) <= 10;
}

/**
 * A colour's identity, independent of how it was written. #111, #111111 and
 * hsla(0, 0%, 6.7%, 1) are one colour; comparing them as strings said three.
 * Also accepts Tailwind v3's bare HSL triplet (`222.2 47.4% 11.2%`), which is
 * how every shadcn v3 theme states its colours.
 * Returns null when the value is not a literal colour (a var(), a template
 * hole, a calc()), which is the caller's signal to leave it alone.
 */
export function canonical(raw) {
  const v = String(raw).trim();
  if (!v || /var\(|\$\{|calc\(/.test(v)) return null;
  const t = HSL_TRIPLET.exec(v);
  const c = parseColor(t ? `hsl(${t[1]} ${t[2]}% ${t[3]}%)` : v.replace(/\s+/g, ' ').toLowerCase());
  if (!c) return null;
  return [c.r, c.g, c.b].map((x) => Math.round(x)).join(',') + ',' + Math.round(c.a * 100);
}

const HSL_TRIPLET =
  /^\s*(-?\d+(?:\.\d+)?)(?:deg)?\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%(?:\s*\/\s*(\d+(?:\.\d+)?%?))?\s*$/;
