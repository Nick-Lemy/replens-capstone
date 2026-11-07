import json
import math
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SessionInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=120)
    result: dict[str, Any]
    review: dict[str, Any] | None = None

    @model_validator(mode="after")
    def check_content(self):
        result = self.result
        if type(result.get("rep_count")) is not int or not 0 <= result["rep_count"] <= 200:
            raise ValueError("Result needs a valid rep count")
        if not isinstance(result.get("reps"), list) or len(result["reps"]) != result["rep_count"]:
            raise ValueError("Result needs a valid rep list")
        duration = result.get("duration_s")
        if type(duration) not in (int, float) or not math.isfinite(duration) or not 0 <= duration <= 180:
            raise ValueError("Result needs a valid duration")
        if len(json.dumps(self.model_dump(), allow_nan=False).encode()) > 256_000:
            raise ValueError("Saved session is too large")
        return self


class SessionOutput(BaseModel):
    id: UUID
    title: str
    createdAt: str
    result: dict[str, Any]
    review: dict[str, Any] | None
