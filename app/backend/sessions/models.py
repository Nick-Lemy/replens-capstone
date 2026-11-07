from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.backend.auth.models import Base


class SavedSession(Base):
    __tablename__ = "saved_sessions"
    __table_args__ = (Index("ix_saved_sessions_owner_created", "user_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("auth_users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(120))
    result: Mapped[dict] = mapped_column(JSON)
    review: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
