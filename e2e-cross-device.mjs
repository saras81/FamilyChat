// Two-device cross-device messaging smoke for FamilyChat web build.
//
// Unlike e2e-local.mjs (single context, no server), this drives TWO isolated
// browser contexts — a parent "device" and a child "device" — against the live
// Matrix homeserver (the cloudflared tunnel baked into src/config.js). It proves
// a message typed on one device is delivered to the other through real Matrix
// rooms, in BOTH directions.
//
// Prereqs: `npm run web:e2e` (dev server on :8099) + Synapse reachable via the
// tunnel in src/config.js. Run with: node e2e-cross-device.mjs
import { chromium } from 'playwright';

const URL = 'http://localhost:8099';
const SHOT = (n) => `/tmp/familychat-xdev-${n}.png`;
const log = (...a) => console.log('•', ...a);
const stamp = Date.now();

// react-navigation keeps prior screens mounted-but-hidden, so the same text /
// placeholder can exist multiple times in the DOM. Always target the visible one.
const makeHelpers = (page, tag) => {
  const visible = page.locator(':visible');
  const seen = (text, exact = false) => page.getByText(text, { exact }).and(visible).first();
  const waitText = (text, timeout = 20000) => seen(text).waitFor({ state: 'visible', timeout });
  const tap = async (text, opts = {}) => {
    const el = page.getByText(text, { exact: opts.exact ?? false }).and(visible);
    // Bottom-tab labels and screen headers can share text; `last` favours the tab
    // bar (rendered later in the DOM) which is what we want for tab navigation.
    const target = opts.last ? el.last() : el.first();
    await target.waitFor({ state: 'visible', timeout: opts.timeout ?? 20000 });
    await target.click();
  };
  const fill = async (placeholder, value) => {
    const el = page.getByPlaceholder(placeholder).and(visible).first();
    await el.waitFor({ state: 'visible', timeout: 20000 });
    await el.fill(value);
  };
  page.on('dialog', (d) => d.accept().catch(() => {}));
  page.on('pageerror', (e) => console.log(`  [${tag} pageerror]`, e.message));
  return { seen, waitText, tap, fill };
};

// The reconciled family contact is the OTHER party: its id is a Matrix user id
// (@user:server) and it carries the family roomId. The local self-contact the
// parent creates during onboarding has neither, so this uniquely identifies the
// cross-device contact derived from room membership.
const RECONCILED = `(() => {
  const cs = JSON.parse(localStorage.getItem('familychat_contacts') || '[]');
  return cs.find(c => c && c.matrix_room_id && String(c.id).startsWith('@')) || null;
})()`;

const waitForReconciledContact = async (page, label, timeout = 60000) => {
  await page.waitForFunction(`!!${RECONCILED}`, null, { timeout, polling: 1000 });
  const name = await page.evaluate(`(${RECONCILED}).display_name`);
  log(`${label}: reconciled cross-device contact present -> "${name}"`);
  return name;
};

// Open a Safe List contact's chat. The same contact name can appear in more than
// one mounted screen: the parent's Dashboard tab lists family members too and stays
// mounted (not display:none) behind the Safe List, so a naive `.first()` grabs the
// Dashboard's hidden copy sitting in dead space, and clicking it does nothing. Pick
// the match that is actually on top — its centre hit-tests to itself or its row —
// which is the row the user sees and taps. Resolves once the chat screen opens.
const openContact = async (page, name) => {
  const visible = page.locator(':visible');
  const matches = page.getByText(name, { exact: false }).and(visible);
  const chatOpen = () =>
    page.getByPlaceholder('Type a message...').and(visible).first()
      .waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false);

  await matches.first().waitFor({ state: 'visible', timeout: 20000 });
  const count = await matches.count();

  for (let attempt = 0; attempt < 3; attempt++) {
    for (let idx = 0; idx < count; idx++) {
      const el = matches.nth(idx);
      const onTop = await el.evaluate((node) => {
        const r = node.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        // Reachable when the hit target is the node, its descendant, or an ancestor
        // (the TouchableOpacity row) — i.e. this copy is the visible, tappable one.
        return !!top && (top === node || node.contains(top) || top.contains(node));
      }).catch(() => false);
      if (!onTop) continue;
      await el.click({ timeout: 4000 }).catch(() => {});
      if (await chatOpen()) return;
    }
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: `/tmp/familychat-xdev-FAIL-${name}.png` });
  throw new Error(`could not open chat for contact "${name}"`);
};

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const parentCtx = await browser.newContext({ viewport: { width: 420, height: 880 } });
  const childCtx = await browser.newContext({ viewport: { width: 420, height: 880 } });
  const parent = await parentCtx.newPage();
  const child = await childCtx.newPage();
  const P = makeHelpers(parent, 'parent');
  const C = makeHelpers(child, 'child');

  const email = `dad+${stamp}@home.test`;
  const pass = 'familypass';
  const CHILD_MSG = 'Hi Dad, home safe! 👋';
  const PARENT_MSG = 'Love you, see you at 6';

  // ── Parent device: onboard, create family (creates the Matrix room), get code ──
  await parent.goto(URL, { waitUntil: 'domcontentloaded' });
  await P.waitText('Parent Login', 60000);
  log('parent device booted');

  await P.tap('Create Parent Account');
  await P.fill('Parent name', 'Dad');
  await P.fill('parent@example.com', email);
  await P.fill('Create password', pass);
  await P.tap('Continue');

  await P.fill('The Johnson Family', 'The Peri Family');
  await P.tap('Finish Setup');           // ← parent (online) creates the aliased family room
  await P.waitText('Success!', 30000);

  const code = await parent.evaluate(() =>
    JSON.parse(localStorage.getItem('familychat_child_invites') || '[]')[0]?.code);
  if (!code) throw new Error('parent never generated an invite code');
  log('invite code (family-room alias):', code);
  await parent.screenshot({ path: SHOT('1-parent-setup') });
  await P.tap('Return to Login');

  // Parent signs in -> brings the real Matrix client online (syncs the family room).
  await P.waitText('Parent Login');
  await P.fill('parent@example.com', email);
  await P.fill('Enter password', pass);
  await P.tap('Sign In', { exact: true });
  await P.waitText('Safe List', 30000);  // bottom-tab label visible from the Dashboard tab
  log('parent signed in (Matrix online)');

  // Hard gate: if registration fell back to a local_ token the homeserver was
  // unreachable and there is no real room — cross-device is impossible. Fail loud.
  const token = await parent.evaluate(() =>
    JSON.parse(localStorage.getItem('familychat_devices') || '[]')
      .find(d => d.id === 'current_device')?.matrix_access_token || '');
  if (!token || token.startsWith('local_')) {
    throw new Error('parent has a local-only session (Matrix registration failed) — no real room, cannot test cross-device');
  }
  log('parent session is a real Matrix token:', token.slice(0, 12) + '…');

  // ── Child device (separate context): link by code -> remote join -> chat ──
  await child.goto(URL, { waitUntil: 'domcontentloaded' });
  await C.waitText('FamilyChat', 60000);
  log('child device booted');
  await C.tap('Child', { exact: true });
  await C.waitText('Link to Family');
  await C.fill('A1B2C3', code);
  await child.screenshot({ path: SHOT('2-child-code') });
  await C.tap('Validate');               // ← no local invite => remote: true => homeserver join

  await child.getByPlaceholder('Your name').and(child.locator(':visible')).first()
    .waitFor({ state: 'visible', timeout: 20000 });
  await C.fill('Your name', 'Mia');
  await C.tap('Start FamilyChat');        // ← child registers, joins the room, reconciles
  await C.waitText('Safe List', 30000);
  log('child onboarded + joined family room');

  // Child's live client reconciles the parent from room membership. Wait for the
  // data, reload to render it (SafeList only refreshes on mount/focus), open chat.
  const parentName = await waitForReconciledContact(child, 'child');
  await child.reload({ waitUntil: 'domcontentloaded' });
  await C.waitText('Safe List', 30000);
  await openContact(child, parentName);   // open the parent chat
  await child.screenshot({ path: SHOT('3-child-chat') });

  // Child -> Parent
  await C.fill('Type a message...', CHILD_MSG);
  await C.tap('Send', { exact: true });
  await C.waitText('home safe', 15000);   // own echo rendered
  log('child sent message to parent');

  // ── Parent receives the child cross-device ──
  const childName = await waitForReconciledContact(parent, 'parent');
  await parent.reload({ waitUntil: 'domcontentloaded' });
  await P.waitText('Safe List', 30000);   // Dashboard tab after reload
  await P.tap('Safe List', { last: true });// switch to the Safe List screen
  await P.waitText(childName, 20000);      // child contact appeared on the parent device
  log(`parent device discovered child contact "${childName}"`);
  await openContact(parent, childName);     // open the child chat
  await P.waitText('home safe', 25000);     // ← child's message delivered through Matrix
  log('✓ child → parent delivery confirmed (cross-device)');
  await parent.screenshot({ path: SHOT('4-parent-received') });

  // ── Parent replies -> child receives live (child is still on the chat screen) ──
  await P.fill('Type a message...', PARENT_MSG);
  await P.tap('Send', { exact: true });
  await P.waitText('Love you', 15000);      // own echo
  log('parent replied to child');

  await C.waitText('Love you, see you at 6', 25000); // ← live receive on the child device
  log('✓ parent → child delivery confirmed (cross-device, live)');
  await child.screenshot({ path: SHOT('5-child-received') });

  await browser.close();
  console.log('\n✅ CROSS-DEVICE PASS — two devices, real homeserver, bidirectional delivery confirmed.');
};

run().catch(async (e) => {
  console.error('\n❌ CROSS-DEVICE FAIL:', e.message);
  process.exit(1);
});
