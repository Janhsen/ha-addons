# MCP Memory Service

Self-hosted long-term memory for AI assistants, packaged from
[doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service) (Apache-2.0).
The upstream version is pinned in the `Dockerfile`; this add-on only wraps the official image.

## What it does

Claude, ChatGPT and other MCP clients store and search memories through the Streamable HTTP
endpoint `/mcp`. Search is semantic (local ONNX embeddings, no external API). Data is kept in
SQLite below `/data`.

## Options

Only `api_key` and `public_url` are needed. All other options are optional and hidden by default
(toggle "Show unused optional configuration options"); the defaults below apply when they are not set.

| Option | Meaning |
|---|---|
| `api_key` | Required, at least 24 characters. Entered once on the approval page of each client. |
| `public_url` | Required. Public HTTPS address of the tunnel, without `/mcp`. Used as OAuth issuer. |
| `embedding_model` | Default `paraphrase-multilingual-MiniLM-L12-v2` (German and English). |
| `cors_origins` | Default `https://claude.ai,https://claude.com`. Browser origins that may call the service. |
| `access_token_minutes` / `refresh_token_days` | Default `60` minutes / `30` days. Token lifetimes. |
| `log_level` | Default `INFO`. `DEBUG`, `INFO`, `WARNING`, `ERROR`. |
| `dashboard` | Default `true`. Starts the upstream web dashboard and shows it in the sidebar (ingress). |
| `consolidation` | Default `false`. Upstream autonomous consolidation (clustering, compression, associations) on its default schedule. |
| `nli` | Default `false`. Upstream contradiction detection (heuristic backend). |
| `bootstrap` | Default `false`. Enables `get_bootstrap_profile` for agents. |
| `agent_id` | Optional. Default author id written to memories stored through MCP. |

Changing `embedding_model` after memories exist requires re-embedding them with upstream's
`scripts/maintenance/regenerate_embeddings.py`; otherwise search quality drops.

## Dashboard (sidebar)

With `dashboard` enabled the add-on starts upstream's HTTP server (`memory server --http`) on
`127.0.0.1:8000` inside the container. It is not published as a port. Home Assistant shows it
under **Memory** in the sidebar through ingress, so only logged-in Home Assistant users reach it.
A small proxy in the add-on accepts connections only from the ingress gateway, sets the page's
`<base href>` to the ingress prefix, allows Home Assistant to show the page in its iframe and sends
the API key as bearer token, so no second login is needed.

The dashboard is a second process on the same SQLite database (WAL mode). It needs extra memory
for its own copy of the embedding model. If it is not needed, set `dashboard` to `false`.
Upstream features that need an external LLM, Cloudflare or a second instance (search summaries,
quality scoring with a remote model, hybrid sync, reranking) are not exposed as options.

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
upstream schema changes are not reversible. Patch and minor upstream versions are merged automatically after a 5-day wait and a green smoke test; major versions are never updated automatically.
