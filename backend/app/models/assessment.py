from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


assessment_documents = Table(
    "assessment_documents",
    Base.metadata,
    Column("assessment_id", ForeignKey("assessments.id", ondelete="CASCADE"), primary_key=True),
    Column("document_id", ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
)


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    goal: Mapped[str] = mapped_column(Text)
    target_role: Mapped[str] = mapped_column(String(120))
    # easy | medium | hard
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")
    question_count: Mapped[int] = mapped_column(Integer, default=6)
    # draft | published | closed
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    
    # practice | assessment
    exam_mode: Mapped[str] = mapped_column(String(20), default="practice", index=True)
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    attempt_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    show_answers: Mapped[bool] = mapped_column(Boolean, default=True)
    show_explanations: Mapped[bool] = mapped_column(Boolean, default=True)

    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    documents = relationship("Document", secondary=assessment_documents)
    questions = relationship(
        "Question", back_populates="assessment", cascade="all, delete-orphan"
    )
