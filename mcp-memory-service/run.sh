#!/bin/bash
# Maps the Home Assistant add-on options to the environment of mcp-memory-service.
# shellcheck disable=SC2155
set -euo pipefail

OPTIONS=/data/options.json

opt() {
    python3 -c "import json,sys; print(json.load(open('$OPTIONS')).get(sys.argv[1], ''))" "$1"
}

API_KEY="$(opt api_key)"
PUBLIC_URL="$(opt public_url)"

if [ "${#API_KEY}" -lt 24 ]; then
    echo "[ERROR] Option api_key is missing or shorter than 24 characters. Set a long random key and restart." >&2
    exit 1
fi
if [ -z "$PUBLIC_URL" ]; then
    echo "[ERROR] Option public_url is empty. Enter the public HTTPS address of the tunnel (without /mcp)." >&2
    exit 1
fi
case "$PUBLIC_URL" in
    https://*) ;;
    *) echo "[ERROR] public_url must start with https://" >&2; exit 1 ;;
esac

mkdir -p /data/cache /data/backups
# The embedding model is cached below $HOME; keep it in /data so it survives restarts.
mkdir -p /root/.cache
rm -rf /root/.cache/mcp_memory
ln -sfn /data/cache /root/.cache/mcp_memory

umask 077
# Persistent signing keys: without them every restart would invalidate all tokens.
if [ ! -s /data/oauth_private.pem ] || [ ! -s /data/oauth_public.pem ]; then
    echo "[INFO] Creating OAuth signing keys"
    python3 - <<'PY'
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
with open("/data/oauth_private.pem", "wb") as f:
    f.write(key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption()))
with open("/data/oauth_public.pem", "wb") as f:
    f.write(key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo))
PY
    chmod 600 /data/oauth_private.pem
fi

export MCP_MODE=streamable-http
export MCP_SSE_HOST=0.0.0.0
export MCP_SSE_PORT=8765

export MCP_API_KEY="$API_KEY"
export MCP_OAUTH_ENABLED=true
export MCP_OAUTH_ISSUER="${PUBLIC_URL%/}"
export MCP_OAUTH_STORAGE_BACKEND=sqlite
export MCP_OAUTH_SQLITE_PATH=/data/oauth.db
export MCP_OAUTH_PRIVATE_KEY_PATH=/data/oauth_private.pem
export MCP_OAUTH_PUBLIC_KEY_PATH=/data/oauth_public.pem
export MCP_OAUTH_ACCESS_TOKEN_EXPIRE_MINUTES="$(opt access_token_minutes)"
export MCP_OAUTH_REFRESH_TOKEN_EXPIRE_DAYS="$(opt refresh_token_days)"
export MCP_ALLOW_ANONYMOUS_ACCESS=false
export MCP_CORS_ORIGINS="$(opt cors_origins)"

export MCP_MEMORY_STORAGE_BACKEND=sqlite_vec
export MCP_MEMORY_SQLITE_PATH=/data/sqlite_vec.db
export MCP_MEMORY_BACKUPS_PATH=/data/backups
export MCP_MEMORY_SQLITE_PRAGMAS="journal_mode=WAL,busy_timeout=15000"
export MCP_EMBEDDING_MODEL="$(opt embedding_model)"
export MCP_LOG_LEVEL="$(opt log_level)"

echo "[INFO] Issuer: ${MCP_OAUTH_ISSUER}, embedding model: ${MCP_EMBEDDING_MODEL}"
exec /usr/local/bin/docker-entrypoint-unified.sh "$@"
