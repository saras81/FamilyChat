// Registration-lockdown e2e for the FamilyChat Synapse homeserver.
//
// Unlike e2e-local.mjs / e2e-cross-device.mjs (browser-driven, prove the app's
// happy path), this is a pure-HTTP test against the homeserver's registration
// UIA. It guards the LOCKDOWN itself — the property a browser test can't express,
// because the shipped app always carries the token and so can never demonstrate
// the anonymous-bot case. It asserts, directly against /_matrix/client/v3/register:
//
//   1. The register flow REQUIRES m.login.registration_token — no open
//      dummy-only flow exists. This is the regression guard: if start.sh ever
//      flips back to enable_registration_without_verification, this fails.
//   2. An anonymous m.login.dummy registration is REJECTED (the bot case).
//   3. A bogus registration token is REJECTED (the gate validates the token,
//      it isn't just decoration).
//   4. A staged token + dummy registration SUCCEEDS with a real syt_ token
//      (the app's own onboarding still self-serves). Needs the real token.
//
// Tests 1–3 need NO secret, so they run anywhere (incl. CI) as a live guard.
// Test 4 needs the real token and SKIPS if it isn't provided.
//
// No browser, no expo, no dev server — plain global fetch (Node 18+).
//
// Run (negative-only, no token):   node e2e-registration-gate.mjs
// Run (full, with the token):      EXPO_PUBLIC_REG_TOKEN=<token> node e2e-registration-gate.mjs
// Point at another homeserver:     HOMESERVER_URL=https://… EXPO_PUBLIC_REG_TOKEN=<token> node e2e-registration-gate.mjs
//
// Test 4 creates one throwaway account (gatetest_<ts>) on the target server per
// run, exactly as e2e-cross-device.mjs does. The token is read from env and is
// never written into this file or the repo.

const HS = (process.env.HOMESERVER_URL || process.env.EXPO_PUBLIC_HOMESERVER_URL ||
  'https://synapse-production-ef7b.up.railway.app').replace(/\/+$/, '');
const TOKEN = process.env.EXPO_PUBLIC_REG_TOKEN || process.env.REG_TOKEN || '';
const REG = `${HS}/_matrix/client/v3/register`;

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) failed++; };

// POST to the register endpoint; return { status, json }. UIA responses are 401
// with a JSON body, successful completion is 200 — both carry JSON we want.
const post = async (body) => {
  const res = await fetch(REG, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON error page */ }
  return { status: res.status, json };
};

// A bare register probe always returns a fresh UIA session + the flows the server
// will accept. Each test probes its own session so completing a stage in one test
// can't leak into another.
const freshProbe = async () => {
  const r = await post({});
  return { status: r.status, session: r.json?.session, flows: r.json?.flows || [] };
};

const stagesOf = (f) => f.stages || [];

const run = async () => {
  console.log(`\n▶ registration gate — ${HS}\n`);

  // ── 1. The flow requires a token (no open dummy-only flow) ──────────────────
  const probe = await freshProbe();
  ok(probe.status === 401 && !!probe.session,
    `register probe returns a UIA session (status ${probe.status})`);
  const everyFlowNeedsToken = probe.flows.length > 0 &&
    probe.flows.every((f) => stagesOf(f).includes('m.login.registration_token'));
  const anyOpenFlow = probe.flows.some((f) => {
    const s = stagesOf(f);
    return s.length === 1 && s[0] === 'm.login.dummy';
  });
  ok(everyFlowNeedsToken && !anyOpenFlow,
    `every registration flow requires m.login.registration_token — no open flow ` +
    `(flows: ${JSON.stringify(probe.flows.map(stagesOf))})`);

  // ── 2. Anonymous m.login.dummy is rejected (the bot case) ───────────────────
  const fp2 = await freshProbe();
  const anon = await post({
    auth: { type: 'm.login.dummy', session: fp2.session },
    username: `bot_${Date.now()}`,
    password: 'bot-password-123',
  });
  const anonRegistered = anon.status === 200 && !!anon.json?.access_token;
  ok(!anonRegistered,
    `anonymous m.login.dummy is REJECTED (status ${anon.status}, completed ` +
    `${JSON.stringify(anon.json?.completed || [])}, no access_token)`);

  // ── 3. A bogus token is rejected (the gate actually validates the token) ─────
  const fp3 = await freshProbe();
  const bogus = await post({
    auth: { type: 'm.login.registration_token', token: 'not-a-real-token-xyz', session: fp3.session },
  });
  const bogusAccepted = (bogus.json?.completed || []).includes('m.login.registration_token');
  ok(bogus.status !== 200 && !bogusAccepted,
    `a bogus registration token is REJECTED (status ${bogus.status}, ` +
    `errcode ${bogus.json?.errcode || '—'})`);

  // ── 4. Staged token + dummy succeeds (needs the real token) ─────────────────
  if (!TOKEN) {
    console.log('  ⊘ SKIP staged token+dummy success — set EXPO_PUBLIC_REG_TOKEN to run it');
  } else {
    const fp4 = await freshProbe();
    const localpart = `gatetest_${Date.now()}`;
    const password = `Gate-${Date.now()}!`;
    // Stage 1: satisfy the token stage. Still 401 until dummy also completes.
    const tStage = await post({
      auth: { type: 'm.login.registration_token', token: TOKEN, session: fp4.session },
      username: localpart, password,
    });
    const tokenAccepted = (tStage.json?.completed || []).includes('m.login.registration_token');
    ok(tokenAccepted,
      `the real token satisfies the m.login.registration_token stage ` +
      `(completed ${JSON.stringify(tStage.json?.completed || [])})`);
    // Stage 2: satisfy dummy → flow complete → 200 + real account.
    const done = await post({
      auth: { type: 'm.login.dummy', session: fp4.session },
      username: localpart, password,
    });
    const realToken = done.status === 200 &&
      typeof done.json?.access_token === 'string' &&
      done.json.access_token.startsWith('syt_');
    ok(realToken,
      `staged token+dummy SUCCEEDS with a real syt_ token ` +
      `(status ${done.status}, user ${done.json?.user_id || '—'})`);
  }

  console.log('');
  if (failed) {
    console.error(`❌ REGISTRATION GATE FAIL — ${failed} assertion(s) failed.`);
    process.exit(1);
  }
  console.log('✅ REGISTRATION GATE PASS — anonymous signups blocked, token-gated registration works.');
};

run().catch((e) => {
  console.error('\n❌ REGISTRATION GATE ERROR:', e.message);
  process.exit(1);
});
