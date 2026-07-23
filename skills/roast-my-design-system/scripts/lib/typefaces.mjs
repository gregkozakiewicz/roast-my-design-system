/**
 * Normalize font-family declarations to real typeface names. "16 font
 * families" overstates when var(--font-cal), "Cal Sans" and inherit all
 * reference the same face — the honest number is distinct typefaces.
 */
export const GENERIC_FONTS = new Set(['sans-serif', 'serif', 'monospace', 'system-ui', 'ui-sans-serif',
  'ui-serif', 'ui-monospace', 'inherit', 'initial', 'unset', 'cursive', 'fantasy', '-apple-system']);

export function typefaceOf(decl) {
  for (let part of decl.split(',')) {
    part = part.trim().replace(/^["']|["']$/g, '');
    if (!part || part.startsWith('var(') || GENERIC_FONTS.has(part.toLowerCase())) continue;
    return part;
  }
  return null;
}

export const distinctTypefaces = (fontFamilies) =>
  [...new Set(fontFamilies.map((f) => typefaceOf(f.value)).filter(Boolean))];
