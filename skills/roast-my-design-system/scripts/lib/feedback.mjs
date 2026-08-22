// The one place feedback is asked for. Used by the report footer and by the
// npx CLI's outro, so the wording and the link never drift apart.
//
// It is a plain link to a GitHub issue form (.github/ISSUE_TEMPLATE/feedback.yml
// in the public repo, which is where the questions and Greg's note live, so the
// wording can change without a release). Nothing is sent and nothing is
// collected: the tool promises that nothing leaves the machine, and the link
// carries the version only, so a scan can never publish itself by accident.

const REPO = 'https://github.com/pencilrebel/roast-my-design-system';

export const FEEDBACK_ASK = 'Think it got something wrong?';
export const FEEDBACK_CTA = 'Say so, and say which bit';

// The other half of the same deal: the roast cuts both ways. Nothing can
// star a repo from a link, so this lands on the page where the button is.
export const STAR_ASK = 'Think it got it right?';
export const STAR_CTA = 'A star helps other people find it';
export const STAR_URL = REPO;

export function feedbackUrl(version) {
  // `version` matches the input id in feedback.yml, which is how GitHub issue
  // forms accept a prefilled value.
  return `${REPO}/issues/new?template=feedback.yml&version=${encodeURIComponent(version)}`;
}
