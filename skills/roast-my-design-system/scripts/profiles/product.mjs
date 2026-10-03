/**
 * Product — the default. An app, a site, a monorepo of apps: the components
 * are used where they are defined, so usage means adoption, an orphan is a
 * wrong answer waiting to be picked, and every tile scores as written.
 *
 * Always matches. It is the fallback, and it must stay the last entry in
 * profiles/index.mjs. It carries no special knowledge on purpose: anything a
 * kind of repo needs read differently belongs in that kind's own file.
 */
export default {
  kind: 'product',

  recognise(profile) {
    return {
      confidence: 'high',
      evidence: [profile.libraryPkg
        ? `publishable package ${profile.libraryPkg} present, but the repo has app pages next to its components`
        : 'no publishable components package; components are used where they are defined'],
    };
  },
};
