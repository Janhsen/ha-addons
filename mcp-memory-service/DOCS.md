# MCP Memory Service

Self-hosted long-term memory for AI assistants, packaged from
[doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service) (Apache-2.0).
The upstream version is pinned in the `Dockerfile`; this add-on only wraps the official image.

## What it does

Claude, ChatGPT and other MCP clients store and search memories through the Streamable HTTP
endpoint `/mcp`. Search is semantic (local ONNX embeddings, no external API). Data is kept in
SQLite below `/data`.

## Options

| Option | Meaning |
|---|---|
| `api_key` | Required, at least 24 characters. Entered once on the approval page of each client. |
| `public_url` | Required. Public HTTPS address of the tunnel, without `/mcp`. Used as OAuth issuer. |
| `embedding_model` | Default `paraphrase-multilingual-MiniLM-L12-v2` (German and English). |
| `cors_origins` | Browser origins that may call the service. |
| `access_token_minutes` / `refresh_token_days` | Token lifetimes. |
| `log_level` | `DEBUG`, `INFO`, `WARNING`, `ERROR`. |

Changing `embedding_model` after memories exist requires re-embedding them with upstream's
`scripts/maintenance/regenerate_embeddings.py`; otherwise search quality drops.

## Exposing it safely

Do not publish the port directly and do not expose the Home Assistant UI. Use a reverse proxy or a tunnel with its own hostname that points to `http://<host>:9585` and allow only these paths:

- `/mcp`
- `/oauth/*`
- `/.well-known/*`

Everything else (dashboard, REST API, health) stays internal. Add a rate limit for `/oauth/*`.

OAuth clients register themselves (dynamic client registration is required by claude.ai), but a
client only receives a token after someone enters the `api_key` on the approval page. Upstream refuses the
`client_credentials` grant while registration is open.

## Connecting clients

- **claude.ai**: Settings → Connectors → Add custom connector → `https://<public_url>/mcp`, then enter
  the API key on the approval page.
- **ChatGPT**: enable developer mode, add a connector with the same URL, approve with the API key.

## Backups and updates

`/data` (memories, OAuth database, signing keys) is included in Home Assistant backups. The
downloaded model cache is excluded and fetched again when missing. Take a backup before updating;
upstream schema changes are not reversible. Major upstream versions are not updated automatically.
