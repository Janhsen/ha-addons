#!/bin/bash
# Maps the Home Assistant add-on options to the environment of mcp-memory-service.
# shellcheck disable=SC2155
set -euo pipefail

OPTIONS=/data/options.json

# opt NAME [DEFAULT]: value of an option, or DEFAULT when it is missing or empty.
opt() {
    python3 -c "import json,sys; v=json.load(open('$OPTIONS')).get(sys.argv[1]); print(sys.argv[2] if v in (None, '') else v)" "$1" "${2:-}"
}

optb() {
    python3 -c "import json,sys; v=json.load(open('$OPTIONS')).get(sys.argv[1]); print('true' if (sys.argv[2]=='true' if v is None else v) else 'false')" "$1" "$2"
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
export MCP_OAUTH_ACCESS_TOKEN_EXPIRE_MINUTES="$(opt access_token_minutes 60)"
export MCP_OAUTH_REFRESH_TOKEN_EXPIRE_DAYS="$(opt refresh_token_days 30)"
export MCP_ALLOW_ANONYMOUS_ACCESS=false
export MCP_CORS_ORIGINS="$(opt cors_origins https://claude.ai,https://claude.com)"

export MCP_MEMORY_STORAGE_BACKEND=sqlite_vec
export MCP_MEMORY_SQLITE_PATH=/data/sqlite_vec.db
export MCP_MEMORY_BACKUPS_PATH=/data/backups
export MCP_MEMORY_SQLITE_PRAGMAS="journal_mode=WAL,busy_timeout=15000"
export MCP_EMBEDDING_MODEL="$(opt embedding_model paraphrase-multilingual-MiniLM-L12-v2)"
export MCP_LOG_LEVEL="$(opt log_level INFO)"

export MCP_MDNS_ENABLED=false
[ "$(optb consolidation false)" = "true" ] && export MCP_CONSOLIDATION_ENABLED=true
[ "$(optb nli false)" = "true" ] && export MCP_NLI_ENABLED=true
[ "$(optb bootstrap false)" = "true" ] && export MCP_BOOTSTRAP_ENABLED=true
AGENT_ID="$(opt agent_id)"
[ -n "$AGENT_ID" ] && export MCP_AGENT_ID="$AGENT_ID"

# Optional dashboard: upstream HTTP server on loopback only, reached through the ingress proxy.
if [ "$(optb dashboard true)" = "true" ]; then
    if command -v memory >/dev/null 2>&1; then
        echo "[INFO] Starting dashboard on 127.0.0.1:8000 and ingress proxy on :8099"
        env -u MCP_MODE MCP_HTTP_ENABLED=true MCP_HTTP_HOST=127.0.0.1 MCP_HTTP_PORT=8000 \
            memory server --http &
        python3 /usr/local/bin/ingress_proxy.py &
    else
        echo "[WARN] 'memory' command not found, dashboard disabled" >&2
    fi
fi

echo "[INFO] Issuer: ${MCP_OAUTH_ISSUER}, embedding model: ${MCP_EMBEDDING_MODEL}"
exec /usr/local/bin/docker-entrypoint-unified.sh "$@"
