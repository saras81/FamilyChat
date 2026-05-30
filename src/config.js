// Homeserver configuration.
//
// The app talks to a Matrix homeserver for real cross-device messaging. The
// permanent server is a Synapse instance on Railway (project familychat-synapse,
// service `synapse`, SQLite on a persistent volume) — see synapse-railway/.
// Override with EXPO_PUBLIC_HOMESERVER_URL to point at a different homeserver
// (e.g. a local Synapse via cloudflared during development); no code change.
export const HOMESERVER_URL =
  process.env.EXPO_PUBLIC_HOMESERVER_URL ||
  'https://synapse-production-ef7b.up.railway.app';

// The Matrix server_name — the part after ':' in user IDs (@ra:familychat.chat)
// and room aliases (#familychat-abc123:familychat.chat). This is fixed by the
// Synapse homeserver.yaml (`server_name`) and does NOT change with the tunnel URL.
export const HOMESERVER_NAME =
  process.env.EXPO_PUBLIC_HOMESERVER_NAME || 'familychat.chat';

// Room alias localpart for a given invite code. The 6-char code is the shared
// secret: anyone who knows it can resolve and join the family room, nobody who
// doesn't can. Lowercased because Matrix alias localparts are case-sensitive and
// we want a single canonical form on both the parent (create) and child (join) sides.
export const roomAliasForCode = (code) =>
  `#familychat-${String(code).toLowerCase()}:${HOMESERVER_NAME}`;

export const roomAliasLocalpart = (code) =>
  `familychat-${String(code).toLowerCase()}`;
