// A file is an email because it is one, not because its path mentions one.
// Until 9.2.3 anything with "email" in the path walked free: every sign-in
// form, email settings screen and inbox. inbox-zero keeps its whole app under
// app/(app)/[emailAccountId]/, and 285 of its screens were never judged
// (2026-09-30). Each case below is a shape found in the cloned fleet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { walkRepo } from '../../skills/roast-my-design-system/scripts/harvest/walk.mjs';
import { harvestTokens } from '../../skills/roast-my-design-system/scripts/harvest/tokens.mjs';
import { loadKnowledge } from '../../skills/roast-my-design-system/scripts/mcp/knowledge.mjs';
import { validateContent } from '../../skills/roast-my-design-system/scripts/mcp/engine.mjs';
import { isEmail, exemptReason, learnSystem } from '../../skills/roast-my-design-system/scripts/lib/guard-api.mjs';

for (const v of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete process.env[v];

const SCREEN = (name) => `export function ${name}() { return <div style={{ color: '#c0ffee', padding: '13px' }}>x</div>; }\n`;
const EMAILS = {
  // twenty: templates built on the team's own layout, which uses the kit
  'packages/emails/src/components/BaseEmail.tsx': "import { Html, Body } from '@react-email/components';\nexport function BaseEmail({ children }) { return <Html><Body>{children}</Body></Html>; }\n",
  'packages/emails/src/emails/billing-renewing.email.tsx': "import { BaseEmail } from '../components/BaseEmail';\nexport function Renewing() { return <BaseEmail><p style={{ color: '#15212a' }}>Renewing</p></BaseEmail>; }\n",
  // cal.com: table attributes only an email carries
  'apps/web/email/Receipt.tsx': 'export function Receipt() { return <table cellPadding="0" style={{ background: "#f4f5f6" }}><tr><td>x</td></tr></table>; }\n',
  // lobe-chat: a server that builds its emails as strings
  'src/libs/auth/email-templates/magic-link.ts': 'export const magicLink = (url) => `<a href="${url}" style="color: #1677ff; padding: 12px">Sign in</a>`;\n',
  // Ghost: code that renders .hbs templates kept beside it
  'server/services/email-service/renderer.js': "export const accent = '#15212a';\n",
  'server/services/email-service/templates/newsletter.hbs': '<table><tr><td>{{title}}</td></tr></table>\n',
  'server/services/gifts/gift-email-service.ts': "export const DEFAULT_ACCENT = '#15212A';\n",
  'server/services/gifts/email-templates/gift.hbs': '<p>{{name}}</p>\n',
  // midday: a preview of an email draws the email's colours
  'src/components/invoice/email-preview.tsx': SCREEN('EmailPreview'),
  // Stirling-PDF: a stylesheet written for emails
  'resources/templates/email-pdf-styles.css': '.header { color: #123456; background: #fafafa; }\n',
  'src/styles/print.css': '.page { color: #000000; }\n',
};
const SCREENS = {
  // inbox-zero: an app under a route named for the account
  'app/(app)/[emailAccountId]/mail/MailShell.tsx': SCREEN('MailShell'),
  'src/features/auth/SignInEmailStep.tsx': SCREEN('SignInEmailStep'),
  // Ghost: the admin screen where a newsletter's colours are picked (judged, by Greg's call)
  'src/settings/email-design/fields/background-color-field.tsx': SCREEN('BackgroundColorField'),
  // OpenCTI: a settings screen for editing templates holds no template
  'src/settings/email_template/EmailTemplates.tsx': SCREEN('EmailTemplates'),
  'src/widgets/users_emails_input.scss': '.input { color: #abcdef; }\n',
};
const root = mkdtempSync(join(tmpdir(), 'roast-email-'));
for (const [f, body] of Object.entries({ 'package.json': '{"name":"mail","private":true,"dependencies":{"react":"^19.0.0"}}', ...EMAILS, ...SCREENS })) {
  mkdirSync(join(root, dirname(f)), { recursive: true });
  writeFileSync(join(root, f), body);
}
const files = walkRepo(root, 14, { patterns: [] });
const read = (f) => readFileSync(join(root, f), 'utf8');
const judged = (f) => !isEmail(f, read(f), files.email);

test('the walk finds where the repo keeps its emails', () => {
  assert.ok(files.email.homes.includes('packages/emails'), files.email.homes.join(', '));
  assert.ok(files.email.homes.includes('server/services/email-service'));
  assert.ok(!files.email.homes.some((h) => h.includes('[emailAccountId]')), 'a route named for an account is not an email folder');
  assert.ok(!files.email.homes.some((h) => h.includes('email-design') || h.includes('email_template')), 'a folder of screens holds no template');
});

for (const f of Object.keys(EMAILS).filter((x) => !x.endsWith('.hbs'))) {
  test(`an email is skipped: ${f}`, () => assert.equal(judged(f), false));
}
for (const f of Object.keys(SCREENS)) {
  test(`a screen about email is judged: ${f}`, () => assert.equal(judged(f), true));
}

test('without the repo, a file is an email only by what it shows itself', () => {
  assert.equal(isEmail('apps/web/email/Receipt.tsx', read('apps/web/email/Receipt.tsx')), true);
  assert.equal(isEmail('packages/emails/src/emails/billing-renewing.email.tsx', read('packages/emails/src/emails/billing-renewing.email.tsx')), false);
  assert.equal(isEmail('components/two-buttons/tailwind.tsx', "import { Button } from 'react-email';"), true, 'a kit is an email wherever it lives');
  assert.equal(isEmail('src/components/Welcome.tsx', '<table cellPadding="0" />'), false, 'email markup counts only on a path that mentions email');
});

test('the report skips the emails and counts the screens', () => {
  const t = harvestTokens(root, files.styles, files.code, { email: files.email });
  const skipped = new Set(t.exemptFiles.map((e) => e.file));
  assert.ok(skipped.has('packages/emails/src/emails/billing-renewing.email.tsx'));
  assert.ok(skipped.has('server/services/gifts/gift-email-service.ts'));
  assert.ok(!skipped.has('app/(app)/[emailAccountId]/mail/MailShell.tsx'));
  const strays = new Set(t.colors.filter((c) => !c.isToken).map((c) => c.value));
  assert.ok(strays.has('#c0ffee'), 'the screens\' colour is counted');
  assert.ok(!strays.has('#15212a') && !strays.has('#123456') && !strays.has('#1677ff'), 'no email colour is counted');
});

test('the live check gives the report\'s answer on every file', () => {
  const k = loadKnowledge(root);
  for (const f of [...Object.keys(EMAILS), ...Object.keys(SCREENS)].filter((x) => !x.endsWith('.hbs'))) {
    const r = validateContent({ text: read(f), file: f, before: null }, k);
    assert.equal(!r.exempt, judged(f), `${f}: live check ${r.exempt ? 'skipped' : 'judged'} it`);
  }
});

test('the guard doorway hands over the same email folders', () => {
  const system = learnSystem(root);
  assert.deepEqual(system.email, files.email);
  const f = 'packages/emails/src/emails/billing-renewing.email.tsx';
  assert.ok(exemptReason(f, read(f), { email: system.email }));
  assert.equal(exemptReason('src/features/auth/SignInEmailStep.tsx', read('src/features/auth/SignInEmailStep.tsx'), { email: system.email }), null);
});
