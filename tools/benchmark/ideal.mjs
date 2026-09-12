/**
 * The curated Ideal-2026 norms, shared by the fleet builder and the slice
 * builder so both write the same targets. Design judgment (Greg's), not
 * statistics: the page shows these as the TARGET; a scanned median is only
 * the peer bar.
 */
// The curated norms — what a real design system looks like in 2026.
// These are design judgment (Greg's), not statistics. The page shows them
// as the TARGET; the scanned average is only the (low) peer bar.
export const IDEAL_2026 = {
  colors: { value: 24, note: '12-24: brand hue + tints, accent, greys, status' },
  greys: { value: 13, note: 'up to 13 tones (Material neutral palette)' },
  spacing: { value: 12, note: 'off-scale values; a dozen deliberate exceptions' },
  typefaces: { value: 3, note: 'sans for UI, serif accent, mono for code' },
  fontSizes: { value: 10, note: 'a type scale, up to 10 steps' },
  radii: { value: 10, note: 'up to a 10-step corner scale' },
  shadows: { value: 6, note: 'up to 6 elevation levels (0-5)' },
  exactDuplicates: { value: 0, note: 'one canonical implementation each' },
  inlineStyles: { value: 0, note: 'styling belongs to the system' },
  nearPairs: { value: 0, note: 'near-identical colours are copy-paste, not decisions' },
  important: { value: 0, note: '!important is the cascade admitting defeat' },
  neverImported: { value: 0, note: 'a system component nobody imports is dead weight' },
  arbitrary: { value: 20, note: 'bracket escape hatches; a handful of deliberate exceptions' },
  zIndexes: { value: 6, note: 'a fixed layer scale, ~6 layers' },
  fontWeights: { value: 4, note: 'regular, medium, semibold, bold' },
  lineHeights: { value: 5, note: '~1.5 body, ~1.2-1.3 headings' },
  breakpoints: { value: 5, note: 'Tailwind 5, Bootstrap 6, Carbon 5' },
  animationDurations: { value: 6, note: 'a few named durations, 160-360ms' },
  easings: { value: 4, note: 'in, out, in-out, linear' },
  borderWidths: { value: 2, note: 'hairline + emphasis' },
  opacities: { value: 5, note: 'disabled, overlay, hover tints' },
  // The 2 shadcn tiles, per 100 own-code files. Curated from the 2026-09-11
  // probe of the 15 shadcn repos in the fleet: the tidiest third sit under
  // these. Judged only on repos read as shadcn; every other repo ignores them.
  paintTin: { value: 25, note: 'palette colours in own code where a theme variable exists, per 100 files' },
  doorOverrides: { value: 15, note: 'shadcn components given a colour or font through className, per 100 files' },
};

