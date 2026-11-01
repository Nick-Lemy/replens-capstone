from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


Timestamp = Annotated[float, Field(ge=0, le=180, allow_inf_nan=False)]
SourceRep = Annotated[int, Field(strict=True, ge=1, le=200)]


class ReviewRep(BaseModel):
    start_s: Timestamp
    top_s: Timestamp
    end_s: Timestamp
    source_rep: SourceRep | None = None

    @model_validator(mode="after")
    def check_times(self):
        if not self.start_s < self.top_s < self.end_s:
            raise ValueError("Rep times must satisfy start_s < top_s < end_s")
        return self


class SetReviewRequest(BaseModel):
    failure_confirmed: Literal[True]
    all_remaining_reps_visible: Literal[True]
    reps: Annotated[list[ReviewRep], Field(min_length=1, max_length=200)]

    @field_validator("failure_confirmed", "all_remaining_reps_visible", mode="before")
    @classmethod
    def check_confirmation(cls, value):
        if value is not True:
            raise ValueError("Confirmation must be true")
        return value

    @model_validator(mode="after")
    def check_reps(self):
        sources = set()
        previous_end = None
        for rep in self.reps:
            if previous_end is not None and rep.start_s < previous_end:
                raise ValueError("Reps must be chronological and nonoverlapping")
            if rep.source_rep is not None:
                if rep.source_rep in sources:
                    raise ValueError("source_rep values must be unique")
                sources.add(rep.source_rep)
            previous_end = rep.end_s
        return self


class ReviewedRep(ReviewRep):
    rep: int
    observed_rir: int


class SetReviewResponse(BaseModel):
    method: Literal["confirmed_failure_countback"]
    is_prediction: Literal[False]
    rep_count: int
    reps: list[ReviewedRep]
    notice: str
