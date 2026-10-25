"""Recorder DB MCP – read-only MCP server for the Home Assistant recorder database.

Reads the connection URL of a read-only PostgreSQL role from the Home Assistant
secrets.yaml and serves MCP over streamable HTTP under a secret path.
"""

from __future__ import annotations

import datetime as dt
import decimal
import json
import logging
import os
import secrets
import sys
import uuid
from pathlib import Path
from typing import Any

import psycopg
import yaml
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.requests import Request
from starlette.responses import JSONResponse

OPTIONS_FILE = Path("/data/options.json")
SECRET_FILE = Path("/data/secret_path")
SECRETS_YAML = Path("/homeassistant/secrets.yaml")
PORT = 8099

log = logging.getLogger("recorder-db-mcp")


def load_options() -> dict[str, Any]:
    opts = {
        "secrets_key": "recorder_readonly_db_url",
        "max_rows": 5000,
        "statement_timeout_s": 30,
        "log_level": "info",
    }
    if OPTIONS_FILE.exists():
        opts.update(json.loads(OPTIONS_FILE.read_text()))
    return opts


OPTS = load_options()
logging.basicConfig(
    level=getattr(logging, str(OPTS["log_level"]).upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)


def load_db_url() -> str:
    if not SECRETS_YAML.exists():
        log.error("secrets.yaml nicht gefunden (%s)", SECRETS_YAML)
        sys.exit(1)
    data = yaml.safe_load(SECRETS_YAML.read_text()) or {}
    url = data.get(OPTS["secrets_key"])
    if not url:
        log.error("Schlüssel '%s' fehlt in secrets.yaml", OPTS["secrets_key"])
        sys.exit(1)
    return str(url)


def load_secret_path() -> str:
    if SECRET_FILE.exists():
        value = SECRET_FILE.read_text().strip()
        if value:
            return value
    value = secrets.token_urlsafe(32)
    SECRET_FILE.write_text(value)
    SECRET_FILE.chmod(0o600)
    return value


DB_URL = load_db_url()
SECRET = load_secret_path()
MAX_ROWS = int(OPTS["max_rows"])
TIMEOUT_MS = int(OPTS["statement_timeout_s"]) * 1000

INSTRUCTIONS = """\
Read-only access to the Home Assistant recorder database (PostgreSQL).
Every query runs in a READ ONLY transaction as a SELECT-only role.

Schema notes (Home Assistant recorder):
- states: state, last_updated_ts / last_changed_ts (unix seconds, UTC), metadata_id -> states_meta.entity_id,
  attributes_id -> state_attributes.shared_attrs (JSON text).
- statistics (hourly, kept forever) and statistics_short_term (5 minutes): start_ts, mean, min, max, state, sum,
  metadata_id -> statistics_meta.statistic_id (usually the entity_id) and unit_of_measurement.
- events / event_types / event_data for bus events.
Prefer the helper tools find_entities, entity_history and statistics; use run_query for anything else.
Convert *_ts with to_timestamp(x). Local time zone of the house: Europe/Berlin.
"""

mcp = FastMCP(
    name="Recorder DB",
    instructions=INSTRUCTIONS,
    host="0.0.0.0",
    port=PORT,
    streamable_http_path=f"/{SECRET}/mcp",
    stateless_http=True,
    json_response=True,
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


def _jsonable(value: Any) -> Any:
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return bytes(value).hex()
    if isinstance(value, dt.timedelta):
        return value.total_seconds()
    return value


def _run(sql: str, params: Any = None, max_rows: int | None = None) -> dict[str, Any]:
    limit = min(int(max_rows or MAX_ROWS), MAX_ROWS)
    with psycopg.connect(DB_URL, autocommit=False, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute("SET TRANSACTION READ ONLY")
            cur.execute(f"SET LOCAL statement_timeout = {TIMEOUT_MS}")
            cur.execute(sql, params)
            if cur.description is None:
                conn.rollback()
                return {"columns": [], "rows": [], "row_count": 0, "truncated": False}
            columns = [c.name for c in cur.description]
            rows = cur.fetchmany(limit + 1)
            truncated = len(rows) > limit
            rows = rows[:limit]
        conn.rollback()
    return {
        "columns": columns,
        "rows": [[_jsonable(v) for v in r] for r in rows],
        "row_count": len(rows),
        "truncated": truncated,
    }


def _ts(value: str | None) -> float | None:
    if not value:
        return None
    parsed = dt.datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.timestamp()


@mcp.tool()
def list_tables() -> dict[str, Any]:
    """List all tables and views with an estimated row count and size."""
    return _run(
        """
        SELECT n.nspname AS schema, c.relname AS name,
               CASE c.relkind WHEN 'r' THEN 'table' WHEN 'v' THEN 'view' WHEN 'm' THEN 'matview' ELSE c.relkind::text END AS kind,
               GREATEST(c.reltuples, 0)::bigint AS approx_rows,
               pg_size_pretty(pg_total_relation_size(c.oid)) AS size
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname NOT IN ('pg_catalog','information_schema')
          AND n.nspname NOT LIKE '\\_timescaledb%%' AND n.nspname NOT LIKE 'timescaledb%%'
        ORDER BY pg_total_relation_size(c.oid) DESC
        """
    )


@mcp.tool()
def describe_table(table: str, schema: str = "public") -> dict[str, Any]:
    """Show the columns of a table: name, data type and nullability."""
    return _run(
        """
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position
        """,
        (schema, table),
    )


@mcp.tool()
def find_entities(pattern: str = "", limit: int = 200) -> dict[str, Any]:
    """Find recorded entities and statistics whose id contains `pattern` (case-insensitive).

    Returns entity_id, whether it has state history and/or long-term statistics, and the unit.
    """
    like = f"%{pattern}%"
    return _run(
        """
        WITH s AS (SELECT entity_id AS id FROM states_meta WHERE entity_id ILIKE %s),
             m AS (SELECT statistic_id AS id, unit_of_measurement, has_mean, has_sum FROM statistics_meta
                   WHERE statistic_id ILIKE %s)
        SELECT COALESCE(s.id, m.id) AS id, s.id IS NOT NULL AS has_history,
               m.id IS NOT NULL AS has_statistics, m.unit_of_measurement, m.has_mean, m.has_sum
        FROM s FULL OUTER JOIN m ON m.id = s.id
        ORDER BY 1
        """,
        (like, like),
        max_rows=limit,
    )


@mcp.tool()
def entity_history(
    entity_id: str,
    start: str | None = None,
    end: str | None = None,
    include_attributes: bool = False,
    limit: int = 1000,
) -> dict[str, Any]:
    """State history of one entity, oldest first.

    start/end: ISO 8601 (without zone = UTC), e.g. "2026-10-01" or "2026-10-01T06:00:00+02:00".
    include_attributes adds the attribute JSON of every state (bigger result).
    """
    attrs = ", sa.shared_attrs::jsonb AS attributes" if include_attributes else ""
    join = "LEFT JOIN state_attributes sa ON sa.attributes_id = s.attributes_id" if include_attributes else ""
    return _run(
        f"""
        SELECT to_timestamp(s.last_updated_ts) AS last_updated,
               to_timestamp(COALESCE(s.last_changed_ts, s.last_updated_ts)) AS last_changed,
               s.state{attrs}
        FROM states s
        JOIN states_meta m ON m.metadata_id = s.metadata_id
        {join}
        WHERE m.entity_id = %s
          AND (%s::float8 IS NULL OR s.last_updated_ts >= %s::float8)
          AND (%s::float8 IS NULL OR s.last_updated_ts <  %s::float8)
        ORDER BY s.last_updated_ts
        """,
        (entity_id, _ts(start), _ts(start), _ts(end), _ts(end)),
        max_rows=limit,
    )


@mcp.tool()
def statistics(
    statistic_id: str,
    start: str | None = None,
    end: str | None = None,
    period: str = "hour",
    limit: int = 5000,
) -> dict[str, Any]:
    """Long-term statistics of one sensor (usually its entity_id), oldest first.

    period: "hour" (table statistics, kept forever) or "5minute" (statistics_short_term).
    Returns start time, mean, min, max, state and sum plus the unit.
    """
    table = "statistics_short_term" if period == "5minute" else "statistics"
    return _run(
        f"""
        SELECT to_timestamp(st.start_ts) AS start, st.mean, st.min, st.max, st.state, st.sum,
               m.unit_of_measurement AS unit
        FROM {table} st
        JOIN statistics_meta m ON m.id = st.metadata_id
        WHERE m.statistic_id = %s
          AND (%s::float8 IS NULL OR st.start_ts >= %s::float8)
          AND (%s::float8 IS NULL OR st.start_ts <  %s::float8)
        ORDER BY st.start_ts
        """,
        (statistic_id, _ts(start), _ts(start), _ts(end), _ts(end)),
        max_rows=limit,
    )


@mcp.tool()
def run_query(sql: str, max_rows: int = 1000) -> dict[str, Any]:
    """Run one read-only SQL query (PostgreSQL dialect) and return columns and rows.

    Runs in a READ ONLY transaction with a statement timeout; writing is impossible.
    Results are capped (max_rows, hard limit set in the app options).
    """
    return _run(sql, max_rows=max_rows)


@mcp.custom_route("/health", methods=["GET"])
async def health(_: Request) -> JSONResponse:
    return JSONResponse({"status": "ok"})


def main() -> None:
    try:
        info = _run("SELECT current_user, version(), pg_size_pretty(pg_database_size(current_database()))")
        user, version, size = info["rows"][0]
        log.info("Datenbank erreichbar als %s – %s – Größe %s", user, version.split(",")[0], size)
    except Exception as err:  # noqa: BLE001
        log.error("Datenbank nicht erreichbar: %s", err)
    log.info("MCP-Endpunkt (Pfad geheim halten): /%s/mcp  – intern Port %d", SECRET, PORT)
    mcp.run(transport="streamable-http")


if __name__ == "__main__":
    main()
