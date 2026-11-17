"""FastAPI endpoint and strict input/error handling tests (Section 11)."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"
client = TestClient(app)


def _load_fixture_dict(name: str) -> dict:
    return json.loads((FIXTURES_DIR / f"{name}.json").read_text(encoding="utf-8"))


def test_health_and_scenarios_endpoints() -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["live_database_connected"] is False
    assert body["mode"] == "o1-synthetic-local-only"
    assert "ortools_version" in body

    scen = client.get("/v1/scenarios")
    assert scen.status_code == 200
    assert set(scen.json()["scenarios"]) >= {
        "simple_delivery",
        "pooled_delivery",
        "split_collection",
        "shift_conflict",
        "mixed_conditional_collection",
    }


def test_optimize_endpoint_all_fixtures() -> None:
    for name, expected_status in (
        ("simple_delivery", "feasible"),
        ("pooled_delivery", "feasible"),
        ("split_collection", "feasible"),
        ("shift_conflict", "partial"),
        ("mixed_conditional_collection", "feasible"),
    ):
        resp = client.post("/v1/optimize", json=_load_fixture_dict(name))
        assert resp.status_code == 200
        data = resp.json()
        assert data["feasibility_status"] == expected_status
        assert data["constraint_violations"] == []
        assert data["diagnostics"]["verified_hard_constraints"] is True
        if name == "mixed_conditional_collection":
            assert data["collection_plan_safe"] is True
            assert data["operational_commitment_allowed"] is True
            assert data["metrics"]["served_obligation_count"] == 5


def test_simulate_endpoint_compares_baseline_vs_optimized() -> None:
    resp = client.post(
        "/v1/simulate",
        json={"scenario_name": "pooled_delivery", "compare_fairness": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["scenario_name"] == "pooled_delivery"
    assert data["delta_vs_baseline"]["driving_minutes_saved"] > 0
    assert data["delta_vs_baseline"]["empty_driving_minutes_saved"] > 0
    assert data["fairness_off_metrics"] is not None


def test_api_rejects_invalid_coordinates_with_422() -> None:
    payload = _load_fixture_dict("simple_delivery")
    payload["travel_info"]["locations"][0]["lat"] = 95.0
    resp = client.post("/v1/optimize", json=payload)
    assert resp.status_code == 422


def test_api_rejects_mismatched_matrix_dimensions_with_422() -> None:
    payload = _load_fixture_dict("simple_delivery")
    payload["travel_info"]["travel_time_minutes"] = [[0, 10]]  # 1x2 instead of 2x2
    resp = client.post("/v1/optimize", json=payload)
    assert resp.status_code == 422


def test_api_rejects_negative_travel_times_with_422() -> None:
    payload = _load_fixture_dict("simple_delivery")
    payload["travel_info"]["travel_time_minutes"][0][1] = -3.0
    resp = client.post("/v1/optimize", json=payload)
    assert resp.status_code == 422


def test_api_rejects_impossible_time_window_with_422() -> None:
    payload = _load_fixture_dict("simple_delivery")
    payload["transport_obligations"][0]["pickup_window"] = {
        "earliest_minute": 560,
        "latest_minute": 520,
    }
    resp = client.post("/v1/optimize", json=payload)
    assert resp.status_code == 422


def test_api_rejects_duplicate_obligation_ids_with_422() -> None:
    payload = _load_fixture_dict("simple_delivery")
    dup = dict(payload["transport_obligations"][0])
    payload["transport_obligations"].append(dup)
    resp = client.post("/v1/optimize", json=payload)
    assert resp.status_code == 422


def test_api_handles_no_available_drivers_cleanly() -> None:
    payload = _load_fixture_dict("simple_delivery")
    payload["drivers"] = []
    resp = client.post("/v1/optimize", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["feasibility_status"] == "infeasible"
    assert data["all_obligations_served"] is False
    assert data["unassigned_obligations"][0]["reasons"] == ["no_available_drivers"]


def test_api_handles_overcapacity_cleanly() -> None:
    payload = _load_fixture_dict("simple_delivery")
    payload["transport_obligations"][0]["passenger_count"] = 6
    resp = client.post("/v1/optimize", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["feasibility_status"] == "infeasible"
    assert "vehicle_overcapacity" in data["unassigned_obligations"][0]["reasons"]


def test_api_handles_solver_timeout_gracefully(monkeypatch) -> None:
    """Verify timeout status (ROUTING_FAIL_TIMEOUT = 4) never returns invalid routes."""
    import app.solver as solver_mod

    class _FakeRouting:
        def __init__(self, real_routing):
            self._real = real_routing

        def __getattr__(self, name):
            return getattr(self._real, name)

        def SolveWithParameters(self, _params):
            return None

        def status(self):
            return 4  # ROUTING_FAIL_TIMEOUT

    orig_build = solver_mod.build_routing_model

    def fake_build(*args, **kwargs):
        comp = orig_build(*args, **kwargs)
        if comp is not None and comp.routing is not None:
            comp.routing = _FakeRouting(comp.routing)
        return comp

    monkeypatch.setattr(solver_mod, "build_routing_model", fake_build)
    payload = _load_fixture_dict("simple_delivery")
    resp = client.post("/v1/optimize", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["feasibility_status"] == "timeout"
    assert data["diagnostics"]["timed_out"] is True
    assert data["diagnostics"]["routing_status_name"] == "ROUTING_FAIL_TIMEOUT"
    assert data["all_obligations_served"] is False


def test_api_allow_partial_service_false_returns_zero_served_when_any_infeasible() -> None:
    payload = _load_fixture_dict("shift_conflict")
    payload["config"] = {"allow_partial_service": False}
    resp = client.post("/v1/optimize", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["feasibility_status"] == "infeasible"
    assert data["assignments"] == []
    assert data["metrics"]["served_obligation_count"] == 0
    assert data["metrics"]["total_driving_minutes"] == 0.0

