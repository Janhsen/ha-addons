import json
import logging
import math

import pytest


def test_multi_statement_rejected(db):
    for sql in (
        "select 1; commit; set default_transaction_read_only=off; create temp table z(a int)",
        "select 1; select 2",
        "commit; set statement_timeout=0",
    ):
        with pytest.raises(db.UserError, match="einzelnes"):
            db.run_query.__wrapped__(sql)


def test_writes_rejected(db):
    with pytest.raises(db.UserError, match="read-only"):
        db.run_query.__wrapped__("create temp table q(a int)")


def test_percent_in_like_is_literal(db):
    assert db.run_query.__wrapped__("select 'abc' like '%b%' as x")["rows"] == [[True]]


def test_row_cap_and_streaming(db):
    res = db._run("select g from generate_series(1,1000000) g", max_rows=7)
    assert res["row_count"] == 7 and res["truncated"] is True


def test_byte_cap(db):
    res = db._run("select repeat('x', 100000) from generate_series(1, 100)", max_rows=1000)
    assert res["truncated"] is True and res["row_count"] < 30


def test_timeout(db, monkeypatch):
    monkeypatch.setattr(db, "TIMEOUT_MS", 800)
    with pytest.raises(db.UserError, match="abgebrochen"):
        db._run("select pg_sleep(5)")


def test_error_hides_connection_details(db, monkeypatch):
    monkeypatch.setattr(db, "DB_URL", "postgresql://geheim:supersecretpw@127.0.0.1:1/none")
    with pytest.raises(db.UserError) as err:
        db._run("select 1")
    assert "supersecretpw" not in str(err.value) and "127.0.0.1" not in str(err.value)


def test_jsonable(srv):
    out = srv._jsonable([float("nan"), float("inf"), srv.decimal.Decimal("1.5"), {"a": srv.decimal.Decimal("NaN")}])
    assert out == [None, None, 1.5, {"a": None}]
    json.dumps(out, allow_nan=False)


def test_like_escape(srv):
    assert srv._like("a_b%c\\") == "%a\\_b\\%c\\\\%"


def test_date_without_zone_is_berlin(srv):
    assert srv._ts("2026-10-01") == srv._ts("2026-10-01T00:00:00+02:00")
    with pytest.raises(srv.UserError):
        srv._ts("garbage")


def test_window_end_after_start(srv):
    with pytest.raises(srv.UserError):
        srv._window(None, "2026-10-05", "2026-10-01")


def test_access_log_masks_secret(srv):
    record = logging.LogRecord("uvicorn.access", logging.INFO, "", 0, '%s - "%s %s"', ("1.2.3.4", "POST", f"/{srv.SECRET}/mcp"), None)
    assert srv._ACCESS_FILTER.filter(record)
    assert srv.SECRET not in record.getMessage()


def test_404_lines_hidden(srv):
    record = logging.LogRecord("uvicorn.access", logging.INFO, "", 0, "%s %s", ("GET /", 404), None)
    assert srv._ACCESS_FILTER.filter(record) is False


def test_secret_rotation(srv, tmp_path, monkeypatch):
    monkeypatch.setattr(srv, "SECRET_FILE", tmp_path / "secret_path")
    monkeypatch.setattr(srv, "ROTATE_MARKER_FILE", tmp_path / "rotate_marker")
    monkeypatch.setitem(srv.OPTS, "rotate_secret", "")
    first, created = srv.load_secret_path()
    assert created and oct((tmp_path / "secret_path").stat().st_mode & 0o777) == "0o600"
    assert srv.load_secret_path() == (first, False)
    monkeypatch.setitem(srv.OPTS, "rotate_secret", "neu1")
    second, created = srv.load_secret_path()
    assert created and second != first
    assert srv.load_secret_path() == (second, False)
    assert not math.isnan(len(second))
