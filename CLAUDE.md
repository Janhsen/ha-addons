# Working rules for Claude – ha-addons

Public Home Assistant add-on store repository (`https://github.com/Janhsen/ha-addons`). Everything in this repository is public.

## Public-repo rule (always)
- Never write personal data into files, commits, issues or test data: no real names, no places or addresses, no employer, no phone numbers, e-mail addresses, IDs, secret paths or tokens. Use invented examples (Alex, Sam, `+491701234567`).
- Do not describe the owner's private setup (their automations, devices, family, work). Keep text technical.
- Before every push: run a search over the diff and the changed files for such terms and read the result.

## Layout
- `garmin-relay/`: add-on metadata only (`config.yaml`, `DOCS.md`, `CHANGELOG.md`, `translations/`). These files are written by the release workflow of the add-on's source repository. **Do not edit them here.**
- `recorder-db-mcp/`: full source of the Recorder DB MCP add-on (`server.py`, `Dockerfile`, `config.yaml`, `DOCS.md`, `CHANGELOG.md`, `translations/`, `tests/`).
- `fitness-card/`: Lovelace custom card (`fitness-card.js`, loaded via jsDelivr with a fixed commit).
- `.github/workflows/recorder-db-mcp.yml`: tests, `pip-audit`, `bandit`, `hadolint`, then the image build to `ghcr.io/janhsen/amd64-addon-recorder-db-mcp`.

## Recorder DB MCP
- Read-only by design: one SQL statement per query, read-only transaction, time/row/size limits, database role with SELECT only. Never add write access.
- Never log or repeat the secret endpoint path or the database URL.
- Change checklist: `server.py` and `requirements.txt` → raise `version` in `config.yaml` → `CHANGELOG.md` (German) → `DOCS.md` and `translations/` if options change.
- Tests: `python -m pytest recorder-db-mcp/tests -q` with `TEST_DB_URL` pointing at a PostgreSQL database and a read-only role (see the workflow for the exact setup). Also `pip-audit -r recorder-db-mcp/requirements.txt` and `bandit -q -r recorder-db-mcp/server.py -s B104,B105,B608`.
- Set the `image:` line in `config.yaml` only after the image exists on GHCR and the package is public. Home Assistant shows a new version only after the store is reloaded (check updates).
- Do not commit `__pycache__/` or `*.pyc` (covered by `.gitignore`).

## Workflow
- Docs in English. Exception: `CHANGELOG.md` files are German.
- Commit trailer: `Co-Authored-By` and the session link as required by the session.
- Ask the maintainer whether a change goes to a branch or directly to `main`.
- Tests must not create directories in the filesystem root; use a temporary directory.
