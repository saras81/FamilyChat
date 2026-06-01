// End-to-end local smoke for FamilyChat web build (no Matrix server required).
// Drives the real react-native-web DOM through the full parent -> child -> chat flow.
import { chromium } from 'playwright';

const URL = 'http://localhost:8099';
const SHOT = (n) => `/tmp/familychat-e2e-${n}.png`;
const log = (...a) => console.log('•', ...a);

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 } });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

  // react-navigation keeps prior screens mounted-but-hidden in the DOM, so the
  // same text/placeholder can exist multiple times. Always target the visible one.
  const visible = page.locator(':visible');
  const tap = async (text, opts = {}) => {
    const el = page.getByText(text, { exact: opts.exact ?? false }).and(visible).first();
    await el.waitFor({ state: 'visible', timeout: 20000 });
    await el.click();
  };
  const fill = async (placeholder, value) => {
    const el = page.getByPlaceholder(placeholder).and(visible).first();
    await el.waitFor({ state: 'visible', timeout: 20000 });
    await el.fill(value);
  };
  const seen = (text) => page.getByText(text).and(visible).first();
  const waitText = (text, timeout = 20000) => seen(text).waitFor({ state: 'visible', timeout });

  // 0. Boot
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await waitText('Parent Login', 60000);
  log('app booted, login screen visible');
  await page.screenshot({ path: SHOT('1-login') });

  // 1. Parent: create account
  await tap('Create Parent Account');
  await page.getByPlaceholder('Parent name').and(visible).first().waitFor({ state: 'visible', timeout: 20000 });
  await fill('Parent name', 'Dad');
  await fill('parent@example.com', 'dad@home.test');
  await fill('Create password', 'familypass');
  await page.screenshot({ path: SHOT('2-parent-account') });
  await tap('Continue');

  // 2. Parent: family setup
  await page.getByPlaceholder('The Johnson Family').and(visible).first().waitFor({ state: 'visible', timeout: 20000 });
  await fill('The Johnson Family', 'The Peri Family');
  await tap('Finish Setup');

  // 3. Success -> back to login
  await waitText('Success!');
  log('parent account + family created');
  await tap('Return to Login');

  // 4. Grab the invite code that family setup generated
  await waitText('Parent Login');
  const code = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('familychat_child_invites') || '[]')[0]?.code);
  if (!code) throw new Error('no invite code was generated during family setup');
  log('invite code from family setup:', code);

  // 5. Parent signs in
  await fill('parent@example.com', 'dad@home.test');
  await fill('Enter password', 'familypass');
  await tap('Sign In', { exact: true });
  await waitText('Safe List');
  log('parent signed in -> dashboard/tabs visible');
  await page.screenshot({ path: SHOT('3-parent-dashboard') });

  // 6. Simulate the child's device: drop the session, keep the family/invite, reload
  await page.evaluate(() => {
    const devices = JSON.parse(localStorage.getItem('familychat_devices') || '[]')
      .filter((d) => d.id !== 'current_device');
    localStorage.setItem('familychat_devices', JSON.stringify(devices));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitText('Parent Login', 30000);

  // 7. Child: link with the invite code
  await tap('Child', { exact: true });
  await waitText('Link to Family');
  await fill('A1B2C3', code);
  await page.screenshot({ path: SHOT('4-child-code') });
  await tap('Validate');

  // 8. Child: create profile (this is the path that used to hard-fail offline)
  await page.getByPlaceholder('Your name').and(visible).first().waitFor({ state: 'visible', timeout: 20000 });
  await fill('Your name', 'Mia');
  await tap('Start FamilyChat');

  // 9. Child lands in their Safe List
  await waitText('Safe List');
  log('child profile created (local fallback) -> child Safe List visible');
  await page.screenshot({ path: SHOT('5-child-safelist') });

  // 10. Child opens the parent contact and sends a message
  await tap('Dad');
  const input = page.getByPlaceholder('Type a message...');
  await input.waitFor({ timeout: 20000 });
  const MSG = 'Hi Dad, home safe! 👋';
  await input.fill(MSG);
  await tap('Send', { exact: true });

  // 11. Assert the message rendered and was persisted as sent (not failed)
  await waitText(MSG);
  await page.waitForTimeout(500);
  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('familychat_messages') || '[]'));
  const stored = persisted.find((m) => m.body && m.body.includes('home safe'));
  if (!stored) throw new Error('message was not persisted to local store');
  if (stored.status !== 'sent') throw new Error(`message status is "${stored.status}", expected "sent"`);
  log('message sent + persisted with status=sent:', JSON.stringify({ id: stored.id, status: stored.status }));
  await page.screenshot({ path: SHOT('6-chat-sent') });

  // 12. Reload and confirm the message survives
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitText('Safe List', 30000);
  await tap('Dad');
  await waitText(MSG);
  log('message still present after reload (durable)');
  await page.screenshot({ path: SHOT('7-chat-after-reload') });

  await browser.close();
  console.log('\n✅ E2E PASS — parent→family→login→invite→child→chat all green, offline (no Matrix server).');
};

run().catch(async (e) => {
  console.error('\n❌ E2E FAIL:', e.message);
  process.exit(1);
});
