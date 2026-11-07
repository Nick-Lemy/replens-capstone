from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.backend.auth.database import get_session
from app.backend.auth.models import User
from app.backend.auth.routes import check_origin, current_user

from .models import SavedSession
from .schemas import SessionInput, SessionOutput


router = APIRouter(prefix="/api/sessions", tags=["Sessions"])


def output(record: SavedSession) -> SessionOutput:
    return SessionOutput(
        id=UUID(record.id),
        title=record.title,
        createdAt=record.created_at.isoformat(),
        result=record.result,
        review=record.review,
    )


def owned_record(session: Session, user: User, session_id: UUID) -> SavedSession:
    record = session.get(SavedSession, str(session_id))
    if record is None or record.user_id != user.id:
        raise HTTPException(404, "Saved session not found")
    return record


@router.get("", response_model=list[SessionOutput])
def list_sessions(user: User = Depends(current_user), session: Session = Depends(get_session)):
    records = session.scalars(
        select(SavedSession)
        .where(SavedSession.user_id == user.id)
        .order_by(SavedSession.created_at.desc(), SavedSession.id.desc())
    ).all()
    return [output(record) for record in records]


@router.get("/{session_id}", response_model=SessionOutput)
def get_saved_session(session_id: UUID, user: User = Depends(current_user), session: Session = Depends(get_session)):
    return output(owned_record(session, user, session_id))


@router.put("/{session_id}", response_model=SessionOutput, dependencies=[Depends(check_origin)])
def save_session(session_id: UUID, data: SessionInput, user: User = Depends(current_user), session: Session = Depends(get_session)):
    record = session.get(SavedSession, str(session_id))
    if record is not None and record.user_id != user.id:
        raise HTTPException(404, "Saved session not found")
    if record is None:
        record = SavedSession(id=str(session_id), user_id=user.id)
        session.add(record)
    record.title = data.title.strip()
    record.result = data.result
    record.review = data.review
    session.commit()
    session.refresh(record)
    return output(record)


@router.delete("/{session_id}", status_code=204, dependencies=[Depends(check_origin)])
def delete_session(session_id: UUID, user: User = Depends(current_user), session: Session = Depends(get_session)):
    record = owned_record(session, user, session_id)
    session.delete(record)
    session.commit()
