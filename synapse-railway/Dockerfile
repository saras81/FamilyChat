# FamilyChat Matrix homeserver (Synapse) for Railway.
#
# Replaces the ephemeral cloudflared quick-tunnel with a permanent server.
# SQLite lives on a Railway persistent volume mounted at /data, alongside the
# signing key and media store — pilot-appropriate: one volume, no separate
# Postgres service, no boot-ordering race. The signing key is generated ONCE on
# the volume and never regenerated (regenerating would invalidate every device).
#
# Config is rendered fresh from env on every boot (see start.sh) so registration
# / listener tweaks take effect on redeploy without wiping the volume.
FROM matrixdotorg/synapse:latest

COPY start.sh /railway-start.sh
RUN chmod +x /railway-start.sh

# Synapse listens on $PORT (Railway-injected); start.sh binds 0.0.0.0:$PORT.
ENTRYPOINT ["/railway-start.sh"]
