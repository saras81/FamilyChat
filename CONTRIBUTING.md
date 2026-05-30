# Contributing to FamilyChat

Thanks for helping improve FamilyChat. This guide covers the local checks to run
before opening a pull request.

## Setup

```bash
npm install
```

Use an LTS Node version (e.g. Node 20). Running Expo web under Node 25 can hit a
`ERR_SOCKET_BAD_PORT` error before the dev server comes up.

## Static checks

```bash
node --check App.js
node --check src/components/LoginScreen.js
node --check src/components/ChildOnboardingScreen.js
node --check src/components/ChatScreen.js
git diff --check
```

## End-to-end smoke test

[`e2e-local.mjs`](./e2e-local.mjs) is a headless [Playwright](https://playwright.dev)
harness that drives the real `react-native-web` DOM through the full flow —
parent signup → family setup → invite code → child link → chat send — and
asserts the message persists as `sent` and survives a reload. It runs entirely
offline, with **no Matrix homeserver required**, so it's safe to run in CI or on
a fresh clone.

Run it in two terminals:

```bash
# 1. Start the web build on the port the harness expects (8099)
npm run web:e2e

# 2. Once the bundler is serving, run the smoke test
npm run e2e
```

A green run prints:

```
✅ E2E PASS — parent→family→login→invite→child→chat all green, offline
```

Screenshots of each step are written to `/tmp/familychat-e2e-*.png` for debugging.

If you touch the onboarding, login, or chat flows, run this harness and confirm
it still passes before opening a PR.

## Pull requests

- Keep changes focused and describe the user-facing behavior they affect.
- Note whether your change preserves the offline fallback (the app should remain
  functional on a single device without a configured homeserver).
- Mention any new env vars, homeserver assumptions, or migration steps.
