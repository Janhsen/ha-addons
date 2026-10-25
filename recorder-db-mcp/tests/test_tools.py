"""Tests of the analysis tools. They need the recorder tables (states, states_meta, statistics, ...) in the test
database; with TEST_DB_URL pointing at a database without them they are skipped. The data is synthetic."""

import pytest


@pytest.fixture(scope="module")
def rec(db):
    found = db._run("SELECT to_regclass('public.states_meta') IS NOT NULL")["rows"][0][0]
    if not found:
        pytest.skip("recorder tables not in the test database")
    return db


def _call(tool, **kwargs):
    return tool.__wrapped__(**kwargs)


def test_day_hours(srv):
    assert srv._day_hours("2026-10-25") == 25
    assert srv._day_hours("2026-03-29") == 23
    assert srv._day_hours("2026-10-24") == 24


def test_instructions_mention_tools_and_connector(srv):
    for word in ("state_durations", "state_periods", "state_changes", "ha_get_history", "unavailable", "states_meta"):
        assert word in srv.INSTRUCTIONS


def test_local_has_offset(srv):
    assert srv._local(1792000000.0).endswith(("+0100", "+0200"))


def test_daily_has_hours_and_partial_warning(rec):
    res = _call(rec.daily, statistic_id="sensor.temp", days=5)
    assert res["columns"] == ["day", "value", "hours"]
    assert res["partial_days"] and any("incomplete" in w for w in res["warnings"])
    assert res["aggregation"].startswith("mean of hourly means")


def test_daily_change_has_no_hours(rec):
    res = _call(rec.daily, statistic_id="sensor.energy", days=5, agg="change")
    assert res["columns"] == ["day", "value"]


def test_errors_point_to_alternatives(rec):
    res = _call(rec.daily, statistic_id="light.flur")
    assert "state_durations" in res["error"]
    res = _call(rec.compare, statistic_ids=[f"sensor.s{i}" for i in range(9)])
    assert "run_query" in res["error"]


def test_compare_reports_series_start(rec):
    res = _call(rec.compare, statistic_ids=["sensor.temp", "sensor.energy"], days=3)
    assert set(res["series_first_day"]) == {"Temp", "Energie"}


def test_latest_valid_and_offset(rec):
    res = _call(rec.latest, entities=["sensor.temp", "sensor.dead", "light.flur"])
    by_id = {r[0]: r for r in res["rows"]}
    assert res["columns"][-1] == "valid"
    assert by_id["sensor.dead"][-1] is False and by_id["sensor.temp"][-1] is True
    assert by_id["sensor.temp"][2].endswith(("+0100", "+0200"))
    assert "warnings" in res


def test_entity_history_counts_unavailable(rec):
    res = _call(rec.entity_history, entity_id="light.flur")
    assert res["unavailable_rows"] == 1 and "warnings" in res


def test_state_durations(rec):
    res = _call(rec.state_durations, entity_id="light.flur", days=7)
    by_state = {r[0]: r for r in res["rows"]}
    assert abs(by_state["on"][1] - 50 * 3600) <= 2
    assert abs(by_state["unavailable"][1] - 10 * 3600) <= 2
    assert res["covered_seconds"] == sum(r[1] for r in res["rows"])


def test_state_periods(rec):
    res = _call(rec.state_periods, entity_id="light.flur", state="on", days=7)
    assert res["row_count"] == 2 and abs(res["total_seconds"] - 50 * 3600) <= 2
    assert res["ongoing"] is False
    out = _call(rec.state_periods, entity_id="light.flur", state="unavailable", days=7)
    assert out["row_count"] == 1
    assert _call(rec.state_periods, entity_id="light.flur", state="off", days=7)["ongoing"] is True


def test_state_changes(rec):
    res = _call(rec.state_changes, pattern="light.", to_state="on", days=7)
    assert res["rows"][0][0] == "light.flur" and res["rows"][0][1] == 2
    assert "error" in _call(rec.state_changes, pattern="ab")


def test_unknown_entity_gets_hint(rec):
    assert "ha_search" in _call(rec.state_durations, entity_id="light.gibt_es_nicht")["error"]

