from ..schemas import ReviewedRep, SetReviewRequest, SetReviewResponse


def review_set(request: SetReviewRequest) -> SetReviewResponse:
    count = len(request.reps)
    return SetReviewResponse(
        method="confirmed_failure_countback",
        is_prediction=False,
        rep_count=count,
        reps=[
            ReviewedRep(
                **rep.model_dump(), rep=index + 1, observed_rir=count - index - 1
            )
            for index, rep in enumerate(request.reps)
        ],
        notice=(
            "Calculated from a user-reviewed completed failure set; "
            "this is not an ML prediction or physiological verification."
        ),
    )
