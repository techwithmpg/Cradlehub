"""Local FastAPI server for CradleHub O1 OR-Tools Driver Fleet Optimizer."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import fastapi
import ortools
import pydantic
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app import __version__
from app.models import OptimizationResponse, OptimizeRequest, SimulationRequest, SimulationResponse
from app.onsite_models import OnsiteSolveRequest, OnsiteSolveResponse
from app.onsite_solver import solve_onsite_request
from app.solver import optimize_dispatch, run_simulation_comparison
from app.unified_engine import evaluate_unified_operations
from app.unified_models import UnifiedEvaluateRequest, UnifiedEvaluateResponse
from app.validation import RequestValidationError

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"

app = FastAPI(
    title="CradleHub Driver Fleet Optimizer (O1 Foundation)",
    version=__version__,
    description=(
        "Isolated local Google OR-Tools vehicle routing foundation for CradleHub "
        "home-service dispatch. Synthetic data only; does not mutate operational databases."
    ),
)


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Optimization snapshot validation failed.",
            "errors": exc.errors,
        },
    )


def _list_available_fixtures() -> list[str]:
    if not FIXTURES_DIR.exists():
        return []
    return sorted(p.stem for p in FIXTURES_DIR.glob("*.json"))


def load_fixture_request(scenario_name: str) -> OptimizeRequest:
    safe_name = Path(scenario_name).name
    if safe_name != scenario_name or not safe_name:
        raise HTTPException(status_code=400, detail="Invalid scenario_name.")
    fixture_path = FIXTURES_DIR / f"{safe_name}.json"
    if not fixture_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Unknown scenario '{scenario_name}'. Available fixtures: {_list_available_fixtures()}",
        )
    payload: dict[str, Any] = json.loads(fixture_path.read_text(encoding="utf-8"))
    return OptimizeRequest.model_validate(payload)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "cradlehub-driver-optimizer",
        "version": __version__,
        "python_version": sys.version.split()[0],
        "ortools_version": ortools.__version__,
        "fastapi_version": fastapi.__version__,
        "pydantic_version": pydantic.__version__,
        "mode": "o1-synthetic-local-only",
        "live_database_connected": False,
        "available_scenarios": _list_available_fixtures(),
    }


@app.get("/v1/scenarios")
def list_scenarios() -> dict[str, list[str]]:
    return {"scenarios": _list_available_fixtures()}


@app.post("/v1/optimize", response_model=OptimizationResponse)
def optimize_endpoint(payload: OptimizeRequest) -> OptimizationResponse:
    return optimize_dispatch(payload)


@app.post("/v1/simulate", response_model=SimulationResponse)
def simulate_endpoint(payload: SimulationRequest) -> SimulationResponse:
    if payload.custom_request is not None:
        req = payload.custom_request
        scenario_label = payload.scenario_name or req.snapshot_id
    else:
        assert payload.scenario_name is not None
        req = load_fixture_request(payload.scenario_name)
        scenario_label = payload.scenario_name
    return run_simulation_comparison(
        request=req,
        scenario_name=scenario_label,
        compare_fairness=payload.compare_fairness,
    )


@app.post("/v1/onsite/solve", response_model=OnsiteSolveResponse)
def onsite_solve_endpoint(payload: OnsiteSolveRequest) -> OnsiteSolveResponse:
    return solve_onsite_request(payload)


@app.post("/v1/unified/evaluate", response_model=UnifiedEvaluateResponse)
def unified_evaluate_endpoint(payload: UnifiedEvaluateRequest) -> UnifiedEvaluateResponse:
    return evaluate_unified_operations(payload)


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8100, reload=False)
