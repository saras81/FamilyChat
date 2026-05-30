#!/bin/sh
# Render Synapse config from env on every boot, then launch.
#
# Persisted on the Railway volume (/data): the SQLite db, the media store, and
# the signing key. The signing key is generated ONCE and never regenerated —
# regenerating it would invalidate every existing device/session on the server.
# Everything else (registration settings, listener port, secrets) comes from env
# so it can change on redeploy without touching the volume.
set -eu

DATA="${SYNAPSE_DATA_DIR:-/data}"
SERVER_NAME="${SYNAPSE_SERVER_NAME:-familychat.chat}"
PORT="${PORT:-8008}"
CONFIG="/tmp/homeserver.yaml"
KEY="${DATA}/${SERVER_NAME}.signing.key"

mkdir -p "${DATA}/media_store"

if [ ! -f "${KEY}" ]; then
  echo "[start] generating signing key -> ${KEY}"
  if command -v generate_signing_key.py >/dev/null 2>&1; then
    generate_signing_key.py -o "${KEY}"
  else
    python -m synapse._scripts.generate_signing_key -o "${KEY}"
  fi
fi

# public_baseurl must be a valid URL when present, so only emit it when set.
BASEURL_LINE=""
if [ -n "${SYNAPSE_PUBLIC_BASEURL:-}" ]; then
  BASEURL_LINE="public_baseurl: \"${SYNAPSE_PUBLIC_BASEURL}\""
fi

cat > "${CONFIG}" <<YAML
server_name: "${SERVER_NAME}"
pid_file: /tmp/homeserver.pid
${BASEURL_LINE}
listeners:
  - port: ${PORT}
    type: http
    tls: false
    bind_addresses: ['0.0.0.0']
    x_forwarded: true
    resources:
      - names: [client]
        compress: false
database:
  name: sqlite3
  args:
    database: ${DATA}/homeserver.db
media_store_path: ${DATA}/media_store
log_config: "/tmp/log.config"
signing_key_path: "${KEY}"
registration_shared_secret: "${SYNAPSE_REGISTRATION_SHARED_SECRET}"
macaroon_secret_key: "${SYNAPSE_MACAROON_SECRET}"
form_secret: "${SYNAPSE_FORM_SECRET}"
trusted_key_servers: []
suppress_key_server_warning: true
report_stats: false
enable_registration: true
enable_registration_without_verification: true
YAML

cat > /tmp/log.config <<'LOGCFG'
version: 1
formatters:
  precise:
    format: '%(asctime)s - %(name)s - %(lineno)d - %(levelname)s - %(message)s'
handlers:
  console:
    class: logging.StreamHandler
    formatter: precise
root:
  level: INFO
  handlers: [console]
disable_existing_loggers: false
LOGCFG

echo "[start] launching Synapse '${SERVER_NAME}' on 0.0.0.0:${PORT}"
exec python -m synapse.app.homeserver --config-path "${CONFIG}"
