/**
 * What a demo is, said once (10.1.4).
 *
 * Stories, examples, demos and tests are not the product's design language:
 * a story's `export const Default` counted 36 times poisons the numbers, and
 * a demo's colours are nobody's decision. Until 10.1.4 two places decided
 * this. The walk left out examples, demos, tests and *.stories files, and
 * read a stories/ folder; the palette tile and the live palette check kept a
 * pattern of their own that left the stories/ folder out as well. So a story
 * folder's colours were out of the palette count and in every other tile.
 * Now the walk, the palette tile and the live checks all ask this file.
 *
 * Names only, and exact ones: the fleet shows why a looser rule is unsafe.
 * A file called story.ts is midday's writing prompt, storybook-icon.tsx is
 * likec4's icon of the Storybook logo, dify's sandbox.tsx is a billing plan
 * and supabase's examples.tsx is a product page.
 */

// Example integrations, demo apps and playgrounds.
const EXAMPLE_DIRS = ['examples', 'example', 'demos', 'demo', 'playground', 'fixtures', 'fixture'];
// Stories kept in a folder of their own: twenty's __stories__ (326 files),
// sentry's, react-spectrum's stories/, ballerine's _stories, a Storybook
// app in apps/storybook.
const STORY_DIRS = ['stories', '__stories__', '_stories', 'storybook', '.storybook'];
// Test surfaces.
const TEST_DIRS = ['__tests__', '__mocks__', '__fixtures__', '__testfixtures__', '__snapshots__',
  'cypress', 'e2e', 'playwright', 'test', 'tests'];

export const DEMO_DIRS = new Set([...EXAMPLE_DIRS, ...STORY_DIRS, ...TEST_DIRS]);

// A folder whose name starts with storybook is Storybook's too: trigger.dev
// keeps an in-app storybook as routes/storybook.accordion/ and 70 more,
// siemens a storybook-docs package, coder its stories' data in storybookData.
const STORYBOOK_DIR_RE = /^storybook[.\-_A-Z]/;

/** a folder name the scan leaves out as a demo, a story or a test */
export const isDemoDir = (name) => DEMO_DIRS.has(name) || STORYBOOK_DIR_RE.test(name);

// The same at file granularity: Button.test.tsx, Button.stories.tsx, *.cy.ts,
// and a component folder's stories kept as stories.tsx (formbricks, 23).
export const TEST_FILE_RE = /\.(test|spec|stories|story|cy)\.[cm]?[jt]sx?$/;
const STORIES_FILE_RE = /^stories\.[cm]?[jt]sx?$/;

/** a file name the scan leaves out as a story or a test */
export const isDemoFile = (name) => TEST_FILE_RE.test(name) || STORIES_FILE_RE.test(name);

/**
 * A path the scan leaves out as a demo: any folder on the way is a demo
 * folder, or the file itself is a story or a test. For a checker handed one
 * file (the live checks, a guard); the walk asks isDemoDir and isDemoFile
 * as it goes.
 */
export function isDemoPath(file) {
  const parts = String(file).replaceAll('\\', '/').split('/');
  const name = parts.pop();
  return parts.some(isDemoDir) || isDemoFile(name);
}
