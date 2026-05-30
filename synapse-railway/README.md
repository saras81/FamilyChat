# FamilyChat Matrix homeserver (Synapse on Railway)

The permanent homeserver behind FamilyChat cross-device messaging. Replaces the
ephemeral cloudflared quick-tunnel used during early development.

| | |
|---|---|
| **Live URL** | https://synapse-production-ef7b.up.railway.app |
| **server_name** | `familychat.chat` (user IDs `@x:familychat.chat`, aliases `#familychat-<code>:familychat.chat`) |
| **Railway project** | `familychat-synapse` (workspace: A13xPeri's Projects) |
| **Service** | `synapse` · **Volume** | `synapse-volume` mounted at `/data` |
| **Database** | SQLite at `/data/homeserver.db` (pilot scale) |
| **App wiring** | `src/config.js` default `HOMESERVER_URL`; override via `EXPO_PUBLIC_HOMESERVER_URL` |

## How it's built

`Dockerfile` is `matrixdotorg/synapse:latest` + `start.sh`. The config is **not**
baked into the image — `start.sh` renders `homeserver.yaml` from env on every
boot, so registration/listener tweaks take effect on redeploy without touching
the volume. Persisted on the volume: the SQLite db, the media store, and the
signing key.

> ⚠️ **Never wipe the volume.** `/data/familychat.chat.signing.key` is the
> server's identity. `start.sh` generates it once and never regenerates it —
> deleting it (or the volume) invalidates every existing device/session.

## Env vars (set on the Railway service)

| Var | Purpose |
|---|---|
| `SYNAPSE_SERVER_NAME` | `familychat.chat` — must match the app's `HOMESERVER_NAME`. Do not change. |
| `PORT` | `8008` — Synapse binds it; the Railway domain targets it. |
| `SYNAPSE_PUBLIC_BASEURL` | Public URL (trailing slash). Hygiene; the app's flow doesn't require it. |
| `SYNAPSE_REGISTRATION_SHARED_SECRET` | Admin registration secret (`register_new_matrix_user`). |
| `SYNAPSE_MACAROON_SECRET` / `SYNAPSE_FORM_SECRET` | Synapse internal secrets. |

Secrets live only in Railway env — never commit them.

Registration is **open without verification** (`enable_registration_without_verification`),
matching the app's `m.login.dummy` flow. Tighten to token-gated registration
before any public launch.

## Operations

```sh
# Redeploy after editing Dockerfile/start.sh (run from this dir):
railway up -c

# Health:
curl -s https://synapse-production-ef7b.up.railway.app/_matrix/client/versions

# Create an admin user (needs the shared secret):
railway run register_new_matrix_user -c /tmp/homeserver.yaml \
  https://synapse-production-ef7b.up.railway.app
```
