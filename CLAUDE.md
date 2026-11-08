# Working rules for Claude – ha-addons

Public Home Assistant add-on store repository (`https://github.com/Janhsen/ha-addons`). Everything in this repository is public.

## Public-repo rule (always)
- Never write personal data into files, commits, issues or test data: no real names, no places or addresses, no employer, no phone numbers, e-mail addresses, IDs, secret paths or tokens. Use invented examples (Alex, Sam, `+491701234567`).
- Do not describe the owner's private setup (their automations, devices, family, work). Keep text technical.
- Before every push: run a search over the diff and the changed files for such terms and read the result.

## Layout
- `garmin-relay/`: add-on metadata only (`config.yaml`, `DOCS.md`, `CHANGELOG.md`, `translations/`). These files are written by the release workflow of the add-on's source repository. **Do not edit them here.**
- `recorder-db-mcp/`: full source of the Recorder DB MCP add-on (`server.py`, `Dockerfile`, `config.yaml`, `DOCS.md`, `CHANGELOG.md`, `translations/`, `tests/`).
- `mcp-memory-service/`: wrapper add-on around the official upstream image (`Dockerfile` with pinned version, `run.sh`, `ingress_proxy.py`, `config.yaml`, `DOCS.md`, `CHANGELOG.md`, `translations/`). Workflows: `mcp-memory-service.yml` (hadolint, shellcheck, smoke test, image build) and `mcp-memory-service-update.yml` (daily upstream check, 5-day wait, auto-merge of patch/minor after a green smoke test, issue for major).
- `fitness-card/`: Lovelace custom card (`fitness-card.js`, loaded via jsDelivr with a fixed commit).
- `.github/workflows/recorder-db-mcp.yml`: tests, `pip-audit`, `bandit`, `hadolint`, then the image build to `ghcr.io/janhsen/amd64-addon-recorder-db-mcp`.

## Recorder DB MCP
- Read-only by design: one SQL statement per query, read-only transaction, time/row/size limits, database role with SELECT only. Never add write access.
- Never log or repeat the secret endpoint path or the database URL.
- Change checklist: `server.py` and `requirements.txt` → raise `version` in `config.yaml` → `CHANGELOG.md` (German) → `DOCS.md` and `translations/` if options change.
- Tests: `python -m pytest recorder-db-mcp/tests -q` with `TEST_DB_URL` pointing at a PostgreSQL database and a read-only role (see the workflow for the exact setup). Also `pip-audit -r recorder-db-mcp/requirements.txt` and `bandit -q -r recorder-db-mcp/server.py -s B104,B105,B608`.
- Set the `image:` line in `config.yaml` only after the image exists on GHCR and the package is public. Home Assistant shows a new version only after the store is reloaded (check updates).
- Do not commit `__pycache__/` or `*.pyc` (covered by `.gitignore`).

## MCP Memory Service
- Wrapper only: never fork or patch upstream code. Everything is done through environment variables in `run.sh`, the ingress proxy and `config.yaml`. Use only environment variables documented upstream; do not invent names.
- Plug and play: `options:` in `config.yaml` holds only `api_key` and `public_url`. Every other setting is optional in `schema` (`?`) and has its default in `run.sh` (`opt NAME DEFAULT`). Keep `DOCS.md` (defaults) and `translations/` in step.
- Security safeguards (never weaken):
  - OAuth stays mandatory, `MCP_ALLOW_ANONYMOUS_ACCESS=false`, start fails without an `api_key` of at least 24 characters.
  - Only `/mcp`, `/oauth/*` and `/.well-known/*` are meant for the tunnel. The dashboard and REST API listen on `127.0.0.1:8000` only and are reached through ingress (`ingress_proxy.py` on 8099). Never publish 8000 or 8099 as a port.
  - The ingress proxy accepts only the ingress gateway (`172.30.32.2`) and loopback. It may only change `<base href>`, `Location` and `frame-ancestors` (to `'self'`); no other rewriting, so upstream CSP hashes stay valid.
  - Never log the API key, tokens or signing keys.
- Updates: `mcp-memory-service-update.yml` checks upstream every day and merges patch/minor releases to `main` on its own after a 5-day wait and a green smoke test; majors only open an "Upstream major release" issue. Do not remove the wait, the smoke test or the major gate. The weekly update check reports a stuck update.
- The smoke test runs the real image with only the required options and must keep checking: start fails without key, OAuth metadata, anonymous `/mcp` refused, wrong key refused, signing keys persist, dashboard through the proxy (base href, frame-ancestors), proxy refuses other clients. Add a check for every new feature.
- Version scheme `<upstream>-<n>`: raise `<n>` for wrapper changes, write the German `CHANGELOG.md` section first. Changes to this add-on go directly to `main` (maintainer decision). The image is built only after a green smoke test, so Home Assistant may already offer a version whose image does not exist yet: check the CI run before updating in Home Assistant, and fix a red run right away.

## Workflow
- Docs in English. Exception: `CHANGELOG.md` files are German.
- Commit trailer: `Co-Authored-By` and the session link as required by the session.
- Ask the maintainer whether a change goes to a branch or directly to `main`.
- Tests must not create directories in the filesystem root; use a temporary directory.
