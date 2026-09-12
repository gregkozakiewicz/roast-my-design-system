/**
 * Profiles — what kind of repo is this, decided once and read everywhere.
 *
 * The scanner used to answer "is this a library?", "is this a vendored
 * catalogue?", "can I measure components here?" in three separate places:
 * the profiler in harvest/walk.mjs, a block inside harvest/index.mjs, and
 * every consumer re-deriving flags from the raw profile. The MCP path never
 * ran the harvest block at all, so it had no role. Each new kind of repo
 * would have meant one more "unless" clause in each counter, and that is how
 * a scanner stops meaning one thing.
 *
 * The shape now: one file per kind under profiles/, each answering the same
 * questions in the same order. `decideProfile` picks the first kind that
 * recognises the repo (product is the fallback and always matches), records
 * how sure it is and why, and writes the decision onto the harvest profile.
 * `profileOf` is the one accessor consumers read. No counter, report or rules
 * builder asks the raw flags any more.
 *
 * Step 2 of the shadcn-profile plan: this move changes no number. Every
 * fixture's expected output is byte-identical before and after.
 */
import shadcn from './shadcn.mjs';
import library from './library.mjs';
import product from './product.mjs';

// Specific kinds first; product is the fallback and must stay last. The kind
// says how to READ the repo (shadcn: a kit over a sheet); the role says what
// usage MEANS (library: composition, not adoption). A shadcn library keeps
// both: kind shadcn, role library.
export const PROFILES = [shadcn, library, product];

/**
 * Decide the repo's kind from the profiler's facts and what the scan found.
 * Mutates `profile` (the harvest.profile object) so the JSON on disk carries
 * the decision: `role` (the field consumers and summary.json already read),
 * `componentDetection` (measurability), and the new `kind`, `kindConfidence`
 * and `kindEvidence` (the receipt: why this kind, in words).
 */
export function decideProfile(profile, components, files, root = null) {
  const reusable = components.filter((c) => !c.isPage);
  const counts = {
    reusable: reusable.length,
    pages: components.length - reusable.length,
    codeFiles: files.code.length,
  };
  // A handful of pages next to hundreds of components is a demo or test app
  // riding in a library's monorepo (Siemens iX ships two), not a product.
  counts.fewPages = counts.pages <= counts.reusable * 0.05;

  const ctx = { root, files };
  let picked = product, decision = null;
  for (const p of PROFILES) {
    const d = p.recognise(profile, counts, ctx);
    if (d) { picked = p; decision = d; break; }
  }
  // role is usage semantics, decided by the library rule whatever the kind
  profile.role = library.recognise(profile, counts, ctx) ? 'library' : 'product';
  profile.kind = picked.kind;
  profile.kindConfidence = decision.confidence;
  profile.kindEvidence = decision.evidence;

  // Measurability. The gate fires on the situation, never a list of known
  // frameworks: a repo with real code volume where the detector found almost
  // nothing is a repo we could not read, whatever it is written in (the
  // Shoelace lesson: its .define() idiom was invisible and the named-framework
  // gate stayed silent, which would have shipped blind zeros as discipline).
  // Either trigger suffices: a named unreadable stack (Vue/Angular/Svelte
  // markers, however small the repo), or sheer volume the detector saw
  // nothing in (the Shoelace near-miss: unknown idiom, no marker).
  profile.componentDetection = counts.reusable < 3 && (profile.unreadableComponentStack || counts.codeFiles >= 40)
    ? { measured: false, reason: profile.unreadableComponentStack ?? 'a component pattern this scan cannot read' }
    : { measured: true };
  return profile;
}

/**
 * The one accessor. Consumers read these fields and nothing else about the
 * repo's kind. Works on a harvest (h.profile) or a bare profile object, and
 * on harvests written before the profile layer existed (no `kind` field).
 */
export function profileOf(h) {
  const p = h?.profile ?? h ?? {};
  const kind = p.kind ?? p.role ?? 'product';
  const role = p.role ?? (kind === 'library' ? 'library' : 'product');
  return {
    kind,
    role,
    confidence: p.kindConfidence ?? null,
    evidence: p.kindEvidence ?? [],
    isLibrary: role === 'library',
    isShadcn: kind === 'shadcn',
    shadcn: p.shadcn ?? null,
    uiDirs: p.uiDirs ?? (p.uiDir ? [p.uiDir] : []),
    // A vendored shadcn catalogue is stock on a shelf, not abandonment.
    vendoredUi: p.vendoredUi === true,
    uiDir: p.uiDir ?? null,
    componentsMeasured: p.componentDetection?.measured !== false,
    notMeasuredReason: p.componentDetection?.reason ?? 'an unrecognised component pattern',
    designSystem: p.designSystem ?? { kind: 'none' },
  };
}

