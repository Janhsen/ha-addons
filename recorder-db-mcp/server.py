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
from zoneinfo import ZoneInfo

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
Prefer the helper tools; use run_query only for anything they cannot do:
- find_series: find sensors by id OR display name (e.g. "Jan resting heart rate"), with owner/source,
  unit, first/last day and number of points. Use this first when the sensor id is unknown.
- daily: one value per local day (Europe/Berlin) for one sensor - mean, min, max, last or change.
- compare: several sensors side by side, one row per local day.
- gaps: missing hours or days in a series, so gaps are not mistaken for measurements.
- find_entities, entity_history, statistics: the simple building blocks.
Convert *_ts with to_timestamp(x). Local time zone of the house: Europe/Berlin.
"""

TZ = "Europe/Berlin"
MAX_COMPARE = 8
DAILY_AGGS = ("mean", "min", "max", "last", "change")

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


def _window(days: int | None, start: str | None, end: str | None) -> tuple[float | None, float | None]:
    """Start/end as unix seconds. `start` wins over `days` (days back from now)."""
    start_ts = _ts(start)
    if start_ts is None and days:
        start_ts = dt.datetime.now(dt.timezone.utc).timestamp() - int(days) * 86400
    return start_ts, _ts(end)


def _local(ts: float | None) -> str | None:
    if ts is None:
        return None
    return dt.datetime.fromtimestamp(float(ts), ZoneInfo(TZ)).strftime("%Y-%m-%d %H:%M")


def _meta(statistic_id: str) -> dict[str, Any] | None:
    res = _run(
        "SELECT name, unit_of_measurement, has_sum, source FROM statistics_meta WHERE statistic_id = %s",
        (statistic_id,),
    )
    if not res["rows"]:
        return None
    name, unit, has_sum, source = res["rows"][0]
    return {"name": name, "unit": unit, "has_sum": bool(has_sum), "source": source}


def _daily_rows(statistic_id: str, start_ts: float | None, end_ts: float | None, agg: str) -> list[list[Any]]:
    """One [day, value] row per local day (Europe/Berlin) from the hourly statistics table."""
    where = """
        WHERE m.statistic_id = %s
          AND (%s::float8 IS NULL OR s.start_ts >= %s::float8)
          AND (%s::float8 IS NULL OR s.start_ts <  %s::float8)
    """
    if agg == "change":
        # Counter-type series (has_sum): last sum of the day minus last sum of the previous day.
        # Fetch one extra day at the start so the first requested day gets a value.
        first = start_ts - 86400 if start_ts is not None else None
        res = _run(
            f"""
            WITH d AS (
              SELECT (to_timestamp(s.start_ts) AT TIME ZONE %s)::date AS day,
                     (array_agg(s.sum ORDER BY s.start_ts DESC))[1] AS last_sum
              FROM statistics s JOIN statistics_meta m ON m.id = s.metadata_id
              {where}
              GROUP BY 1
            )
            SELECT day::text, (last_sum - lag(last_sum) OVER (ORDER BY day))::float8 AS value
            FROM d ORDER BY day
            """,
            (TZ, statistic_id, first, first, end_ts, end_ts),
        )
        rows = res["rows"]
        return rows[1:] if start_ts is not None and rows else rows
    expr = {
        "mean": "round(avg(s.mean)::numeric, 2)::float8",
        "min": "min(s.min)::float8",
        "max": "max(s.max)::float8",
        "last": "(array_agg(s.mean ORDER BY s.start_ts DESC))[1]::float8",
    }[agg]
    res = _run(
        f"""
        SELECT (to_timestamp(s.start_ts) AT TIME ZONE %s)::date::text AS day, {expr} AS value
        FROM statistics s JOIN statistics_meta m ON m.id = s.metadata_id
        {where}
        GROUP BY 1 ORDER BY 1
        """,
        (TZ, statistic_id, start_ts, start_ts, end_ts, end_ts),
    )
    return res["rows"]


@mcp.tool()
def find_series(pattern: str = "", limit: int = 100) -> dict[str, Any]:
    """Find sensors by id OR display name (case-insensitive), with owner/source and data coverage.

    Searches statistic ids, display names (e.g. "Jan resting heart rate") and recorded entity ids.
    Returns id, name, source, unit, has_history, has_statistics, first_day, last_day (Europe/Berlin)
    and the number of hourly statistic points. Use this first when the sensor id is unknown.
    """
    like = f"%{pattern}%"
    return _run(
        """
        WITH sm AS (
          SELECT id AS mid, statistic_id AS id, name, source, unit_of_measurement AS unit
          FROM statistics_meta WHERE statistic_id ILIKE %s OR name ILIKE %s
        ), st AS (
          SELECT metadata_id, min(start_ts) AS f, max(start_ts) AS l, count(*) AS n
          FROM statistics WHERE metadata_id IN (SELECT mid FROM sm) GROUP BY metadata_id
        ), h AS (
          SELECT entity_id AS id FROM states_meta WHERE entity_id ILIKE %s
        )
        SELECT COALESCE(sm.id, h.id) AS id, sm.name, sm.source, sm.unit,
               h.id IS NOT NULL AS has_history, sm.id IS NOT NULL AS has_statistics,
               to_char(to_timestamp(st.f) AT TIME ZONE %s, 'YYYY-MM-DD') AS first_day,
               to_char(to_timestamp(st.l) AT TIME ZONE %s, 'YYYY-MM-DD') AS last_day,
               st.n AS points
        FROM sm FULL OUTER JOIN h ON h.id = sm.id
        LEFT JOIN st ON st.metadata_id = sm.mid
        ORDER BY 1
        """,
        (like, like, like, TZ, TZ),
        max_rows=limit,
    )


@mcp.tool()
def daily(
    statistic_id: str,
    days: int = 14,
    agg: str = "mean",
    start: str | None = None,
    end: str | None = None,
) -> dict[str, Any]:
    """One value per local day (Europe/Berlin) for one sensor, oldest first.

    agg: "mean" (average of the hourly means), "min", "max", "last" (last hourly mean of the day)
    or "change" (daily increase of a counter/energy sensor, needs a series with sums).
    Window: the last `days` days, or `start`/`end` (ISO 8601, without zone = UTC) if given.
    Returns the sensor name and unit plus columns/rows [day, value]. Resting heart rate -> agg "mean".
    """
    if agg not in DAILY_AGGS:
        return {"error": f"agg must be one of {', '.join(DAILY_AGGS)}"}
    meta = _meta(statistic_id)
    if meta is None:
        return {"error": f"No statistics for '{statistic_id}'. Use find_series to look it up."}
    if agg == "change" and not meta["has_sum"]:
        return {"error": f"'{statistic_id}' has no sums, so 'change' is not available. Use mean, min, max or last."}
    start_ts, end_ts = _window(days, start, end)
    rows = _daily_rows(statistic_id, start_ts, end_ts, agg)
    return {
        "statistic_id": statistic_id,
        "name": meta["name"],
        "unit": meta["unit"],
        "agg": agg,
        "columns": ["day", "value"],
        "rows": rows,
        "row_count": len(rows),
    }


@mcp.tool()
def compare(
    statistic_ids: list[str] | str,
    days: int = 14,
    agg: str = "mean",
    start: str | None = None,
    end: str | None = None,
) -> dict[str, Any]:
    """Several sensors side by side: one row per local day (Europe/Berlin), one column per sensor.

    statistic_ids: a list (or comma-separated string) with up to 8 ids. Columns are labelled with the
    display name. Days without a value show null. agg as in `daily` ("change" only for series with sums).
    """
    ids = [s.strip() for s in statistic_ids.split(",")] if isinstance(statistic_ids, str) else list(statistic_ids)
    ids = [s for s in ids if s]
    if not ids:
        return {"error": "No statistic ids given."}
    if len(ids) > MAX_COMPARE:
        return {"error": f"At most {MAX_COMPARE} series per call."}
    if agg not in DAILY_AGGS:
        return {"error": f"agg must be one of {', '.join(DAILY_AGGS)}"}
    start_ts, end_ts = _window(days, start, end)
    series: list[dict[str, Any]] = []
    for sid in ids:
        meta = _meta(sid)
        if meta is None:
            return {"error": f"No statistics for '{sid}'. Use find_series to look it up."}
        if agg == "change" and not meta["has_sum"]:
            return {"error": f"'{sid}' has no sums, so 'change' is not available."}
        series.append({"id": sid, "meta": meta, "values": dict(_daily_rows(sid, start_ts, end_ts, agg))})
    labels: list[str] = []
    for item in series:
        label = item["meta"]["name"] or item["id"]
        labels.append(item["id"] if label in labels else label)
    all_days = sorted({d for item in series for d in item["values"]})
    rows = [[d] + [item["values"].get(d) for item in series] for d in all_days]
    return {
        "agg": agg,
        "units": {label: item["meta"]["unit"] for label, item in zip(labels, series)},
        "columns": ["day"] + labels,
        "rows": rows,
        "row_count": len(rows),
    }


@mcp.tool()
def gaps(statistic_id: str, days: int = 60, resolution: str = "auto") -> dict[str, Any]:
    """Missing hours or days in the statistics of one sensor, so gaps are not read as measurements.

    resolution: "hour", "day" or "auto" (day for series with about one value per day, e.g. Garmin
    daily values; hour otherwise). Looks at the last `days` days: a gap at the start of that window
    is included, the time since the last point is reported separately (last_point).
    Returns the gap ranges (von, bis, fehlend) in Europe/Berlin plus first/last point and point count.
    """
    if resolution not in ("auto", "hour", "day"):
        return {"error": "resolution must be auto, hour or day"}
    meta = _meta(statistic_id)
    if meta is None:
        return {"error": f"No statistics for '{statistic_id}'. Use find_series to look it up."}
    start_ts, _ = _window(days, None, None)
    base = _run(
        """
        SELECT count(*), min(s.start_ts), max(s.start_ts)
        FROM statistics s JOIN statistics_meta m ON m.id = s.metadata_id
        WHERE m.statistic_id = %s AND (%s::float8 IS NULL OR s.start_ts >= %s::float8)
        """,
        (statistic_id, start_ts, start_ts),
    )
    count, first_ts, last_ts = base["rows"][0]
    if not count:
        return {
            "statistic_id": statistic_id,
            "name": meta["name"],
            "points": 0,
            "note": f"No data in the last {days} days.",
        }
    if resolution == "auto":
        spacing_h = (float(last_ts) - float(first_ts)) / 3600 / max(int(count) - 1, 1)
        resolution = "day" if spacing_h > 12 else "hour"
    if resolution == "day":
        sql = """
            WITH have AS (
              SELECT DISTINCT (to_timestamp(s.start_ts) AT TIME ZONE %s)::date AS d
              FROM statistics s JOIN statistics_meta m ON m.id = s.metadata_id
              WHERE m.statistic_id = %s AND (%s::float8 IS NULL OR s.start_ts >= %s::float8)
            ), rng AS (
              SELECT COALESCE((to_timestamp(%s::float8) AT TIME ZONE %s)::date, min(d)) AS a, max(d) AS b FROM have
            ), grid AS (
              SELECT g::date AS d FROM rng, generate_series(rng.a, rng.b, interval '1 day') g
            ), miss AS (
              SELECT grid.d, grid.d - (row_number() OVER (ORDER BY grid.d))::int AS grp
              FROM grid LEFT JOIN have USING (d) WHERE have.d IS NULL
            )
            SELECT min(d)::text AS von, max(d)::text AS bis, count(*)::int AS fehlend
            FROM miss GROUP BY grp ORDER BY min(d)
        """
        params: tuple[Any, ...] = (TZ, statistic_id, start_ts, start_ts, start_ts, TZ)
    else:
        sql = """
            WITH have AS (
              SELECT DISTINCT floor(s.start_ts / 3600)::bigint * 3600 AS ts
              FROM statistics s JOIN statistics_meta m ON m.id = s.metadata_id
              WHERE m.statistic_id = %s AND (%s::float8 IS NULL OR s.start_ts >= %s::float8)
            ), rng AS (
              SELECT COALESCE(ceil(%s::float8 / 3600)::bigint * 3600, min(ts)) AS a, max(ts) AS b FROM have
            ), grid AS (
              SELECT g AS ts FROM rng, generate_series(rng.a, rng.b, 3600) g
            ), miss AS (
              SELECT grid.ts, grid.ts - (row_number() OVER (ORDER BY grid.ts)) * 3600 AS grp
              FROM grid LEFT JOIN have USING (ts) WHERE have.ts IS NULL
            )
            SELECT to_char(to_timestamp(min(ts)) AT TIME ZONE %s, 'YYYY-MM-DD HH24:MI') AS von,
                   to_char(to_timestamp(max(ts) + 3600) AT TIME ZONE %s, 'YYYY-MM-DD HH24:MI') AS bis,
                   count(*)::int AS fehlend
            FROM miss GROUP BY grp ORDER BY min(ts)
        """
        params = (statistic_id, start_ts, start_ts, start_ts, TZ, TZ)
    res = _run(sql, params)
    return {
        "statistic_id": statistic_id,
        "name": meta["name"],
        "resolution": resolution,
        "points": int(count),
        "first_point": _local(first_ts),
        "last_point": _local(last_ts),
        "columns": res["columns"],
        "rows": res["rows"],
        "gap_count": res["row_count"],
    }


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
