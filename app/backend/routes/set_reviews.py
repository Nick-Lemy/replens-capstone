from fastapi import APIRouter

from ..schemas import SetReviewRequest, SetReviewResponse
from ..services.review import review_set

router = APIRouter()


@router.post("/api/set-reviews", response_model=SetReviewResponse)
def create_set_review(request: SetReviewRequest):
    return review_set(request)
