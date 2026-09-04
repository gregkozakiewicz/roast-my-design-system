// "Why this matters" toggle copy — one entry per finding, unfolds under the
// finding's own evidence block. The finding stays brutal; this text is the calm
// explanation behind it: innocent mechanism, compounding cost, agent amplifier,
// why the ideal sits where it sits.
//
// The copy is Greg-approved word for word (docs/why-behind-copy-approved.md,
// 2026-09-04) and follows docs/greg-copy-style.md. Do not edit casually: every
// number in these texts is a published calibration (ideals + benchmark medians)
// and must move together with benchmark.json if the norms are ever re-tuned.

export const WHY = {
  colors: [
    'Look, nobody consciously chooses 100 colours to start with. They were added with each change, and the change after that. No one was checking for the drift, because no one expected it. Then come the multipliers: a rebrand, a dark-mode pass, ad hoc files, each one multiplying the values again.',
    'When an agent looks for Brand Blue it scans the repo, sees dozens of blues and logically picks the one used most often, which is how the most-used stray outvotes the actual token.',
    '24 covers a whole product: a brand hue with its tints, an accent, the greys, the status colours. The median across 10 reputable design systems is exactly 24.',
  ],
  nearPairs: [
    'A palette is a set of decisions, and two colours a screen can not tell apart are one decision recorded twice. Nobody chooses to own both: someone could not find the first value quickly enough, made a twin by eye, and it stayed.',
    'The cost is never tonight’s screen, which looks fine. It is every choice that comes after: colour pickers now offer both, a search for one misses the other, a dark-mode pass updates one twin and ships the other unchanged, and an agent asked for the dark surface copies whichever it happens to find, so the pair breeds.',
    'The ideal is 0 because each pair collapses in minutes: keep the one that is already a token, point the stray at it, and the multiplication stops. Pound for pound, the cheapest credibility on this page.',
  ],
  greys: [
    'A grey scale is a ladder: each step needs a job (background, border, muted text, disabled) and a visible gap to its neighbours. Around 12 rungs covers every job a real interface has; the reputable systems median is 5.',
    'Past 13 the gaps close, steps stop being distinguishable, and each new grey is no longer a rung but a guess between rungs, which is exactly where twins come from.',
  ],
  spacing: [
    'Nobody starts a design system with 50 spacing values. A deadline, a last-minute change, and someone nudged a layout until it sat right, and 13px honestly sat better than 12px. The next person can not tell a deliberate exception from a new value, or honestly never noticed, and copies it either way.',
    'That is how layout rhythm starts drifting. Two lists almost align, two cards almost match, and the page stops looking right. An agent copies nudge after nudge, because to an agent 13px looks as intentional as 12px. And once one page carries enough exceptions, the agent treats them as canonical, and the poison spreads to the other pages.',
    'The 12 is a budget for values outside the scale, and it is a generous one: the 10 reputable design systems we scanned hold a median of 6. The average product repo carries 34, which is a second, unwritten scale.',
  ],
  typefaces: [
    'One product should have a maximum of 3 font families. When they arrive on their own, it is usually one with a component library, one with a marketing page, one left over from an old logo. Bold and italic do not count; those are weights of one family. And no one will take the risk of removing a font, because nobody is sure what still uses it and what will break.',
    'Every extra font makes pages heavier to load, adds a licence to track, and splits the product’s voice. An agent starting a new page scans the repo, sees several fonts in use, and may feel obligated to use all of them. The split grows on its own.',
    'The ideal is 3, one for each real job: a sans for the interface, a serif if the brand wants an accent, a mono for code.',
  ],
  duplicates: [
    'Nobody builds a second Button on purpose. The first one was hard to find, or almost right but easier to rewrite than to change. On the day, rewriting was the faster choice. And no one deletes the old one later, because nobody is sure what still uses it and what will break.',
    'From then on, every fix reaches one copy and misses the other. Every search has a wrong answer on offer. An agent picks whichever version it happens to find, and every new page makes the more common copy stronger. Common wins over correct, and the drift only deepens.',
    'The ideal is 0, because the fix is cheap: point one copy at the other and the multiplying stops. The average product repo carries 20 duplicated components.',
  ],
  inline: [
    'An inline style is the fastest way to make one element behave. A deadline, one stubborn element, done. On the day, a fair trade.',
    'The cost is that the design system can not see it. Theming misses it, dark mode misses it, a token change misses it. Every inline style is a private exception and requires someone to find it by hand. And agents like inline styles, because they always work and they need no knowledge of your system. Every block already in the repo teaches the agent that this is how styling is done here, so the habit spreads.',
    'The ideal is 0, and the count is fair: only fully static blocks are counted, runtime positioning and canvas work are exempt. The average product repo carries 49 blocks. The 10 reputable systems hold a median of 12.',
  ],
  important: [
    'Every !important marks a styling fight someone had to win by the end of the day. One is harmless. And no one removes it later, because nobody is sure what will break.',
    'But each one raises the floor. The next override in that area has to shout at least as loud, so the count only climbs. An agent that loses a styling fight reaches for !important straight away, because it is the most common CSS fix it has ever seen.',
    'The ideal is 0, because !important is CSS admitting defeat. Fix the rule that kept losing, and the next one is never needed. The average product repo carries 7.',
  ],
  neverImported: [
    'A component nobody imports was built for a future that moved, or replaced and never removed. Writing it was probably right at the time. Leaving it on the shelf is the only mistake.',
    'Every dead component makes the catalogue slower to search and harder to trust. An agent reading your components folder can not tell retired from current, so a dead component becomes a live example to copy.',
    'The ideal is 0, because a design system is the set of things actually in use. And these are the safest deletes in the repo: nothing imports them, so nothing can break. Delete, or mark as deprecated where the agent will read it.',
  ],
  arbitrary: [
    'Brackets exist for a reason. Sometimes the scale really lacks a value, and one w-[137px] for a stubborn third-party embed is craft, done on purpose.',
    'But a bracket is a value with no name. A search for the token will never find it, and a scale change leaves it untouched. An agent that sees brackets in the repo learns that the scale is optional. It can not tell which brackets were deliberate, so it feels free to add its own, and the escape hatch becomes the main door.',
    'The 20 is a budget for real exceptions, and it is a generous one: 9 of the 10 reputable systems we scanned sit at 0, including systems built on Tailwind. The average product repo carries 70.',
  ],
};
