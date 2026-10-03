/**
 * Library — a repo whose consumers live in other repos entirely.
 *
 * A published components package with no app pages: usage counts mean
 * composition, not adoption, orphans are showroom stock rather than dead
 * weight, and the report's language follows. Two ways in, either sufficient:
 *
 * 1. A publishable package with a components-ish name (or the root package
 *    itself being publishable), found by the profiler as `libraryPkg`, next
 *    to at least 5 reusable components and almost no pages.
 * 2. A web-components repo with many tag-registered components and no pages,
 *    whatever its packages are named (Ionic's @ionic/core and Material Web
 *    both dodge the name rule).
 */
export default {
  kind: 'library',

  /** @returns {{ confidence: string, evidence: string[] } | null} */
  recognise(profile, counts) {
    const evidence = [];
    if (profile.libraryPkg && counts.fewPages && counts.reusable >= 5) {
      evidence.push(`publishable package ${profile.libraryPkg} with ${counts.reusable} reusable components and ${counts.pages} page${counts.pages === 1 ? '' : 's'}`);
    }
    if (String(profile.framework).startsWith('web components') && counts.fewPages && counts.reusable >= 10) {
      evidence.push(`${counts.reusable} registered web components and ${counts.pages} page${counts.pages === 1 ? '' : 's'}`);
    }
    return evidence.length ? { confidence: 'high', evidence } : null;
  },
};
