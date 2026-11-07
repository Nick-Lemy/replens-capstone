from typing import Annotated, Literal

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from ..services.analysis import predictor

router = APIRouter()

Time = Annotated[float, Field(ge=0, le=180, allow_inf_nan=False)]
Finite = Annotated[float, Field(allow_inf_nan=False)]


class MotionSample(BaseModel):
    time_s: Time
    dt: Annotated[float, Field(gt=0, le=0.2, allow_inf_nan=False)]
    shoulder_px: Annotated[float, Field(ge=0, le=5000, allow_inf_nan=False)]
    camera_inliers: Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]
    background_error_px: Finite | None
    left_dx: Finite | None
    left_dy: Finite | None
    right_dx: Finite | None
    right_dy: Finite | None


class LiveEstimateRequest(BaseModel):
    model: Literal["speed_only", "speed_shaking"] = "speed_shaking"
    rep: Annotated[int, Field(ge=4, le=200)]
    window_start_s: Time
    current_rep_start_s: Time
    window_end_s: Time
    speed_flow: Annotated[list[MotionSample], Field(min_length=60, max_length=5400)]
    persistent_flow: Annotated[list[MotionSample], Field(max_length=5400)] | None = None

    @model_validator(mode="after")
    def check_window(self):
        if not (
            self.window_start_s
            < self.current_rep_start_s
            < self.window_end_s
        ):
            raise ValueError("Rep boundaries must be chronological")
        if self.model == "speed_shaking" and self.persistent_flow is None:
            raise ValueError("Persistent motion is required for this model")
        for name, rows in (
            ("speed_flow", self.speed_flow),
            ("persistent_flow", self.persistent_flow or []),
        ):
            if rows and (
                rows[0].time_s < self.window_start_s
                or rows[-1].time_s > self.window_end_s
            ):
                raise ValueError(f"{name} lies outside the rep window")
            if any(a.time_s >= b.time_s for a, b in zip(rows, rows[1:])):
                raise ValueError(f"{name} times must increase")
        return self


@router.post("/api/live-estimates")
def estimate_live(request: LiveEstimateRequest):
    try:
        model = predictor.load(request.model)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc

    speed_flow = pd.DataFrame([row.model_dump() for row in request.speed_flow])
    persistent_flow = (
        pd.DataFrame([row.model_dump() for row in request.persistent_flow])
        if request.persistent_flow is not None
        else None
    )
    estimate, reason = model.estimate_window(
        speed_flow,
        persistent_flow,
        request.window_start_s,
        request.window_end_s,
        request.current_rep_start_s,
    )
    return {
        "rep": request.rep,
        "rir": estimate,
        "status": "available" if estimate is not None else "unavailable",
        "reason": reason,
    }
