from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), index=True
    )
    knowledge_point_id: Mapped[int] = mapped_column(
        ForeignKey("knowledge_points.id"), index=True
    )
    question_text: Mapped[str] = mapped_column(Text)
    # mcq | multi | tf | open
    question_type: Mapped[str] = mapped_column(String(10), index=True)
    options_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    correct_answer_json: Mapped[dict | list | str | None] = mapped_column(JSON, nullable=True)
    explanation: Mapped[str] = mapped_column(Text, default="")
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")
    # pending | approved | rejected
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    assessment = relationship("Assessment", back_populates="questions")
    knowledge_point = relationship("KnowledgePoint")
