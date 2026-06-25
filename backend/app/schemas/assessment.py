from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .question import QuestionRead


class AssessmentCreate(BaseModel):
    title: str
    goal: str
    target_role: str
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    question_count: int = Field(6, ge=1, le=30)
    document_ids: list[int] = Field(default_factory=list)
    exam_mode: Literal["practice", "assessment"] = "practice"
    deadline_at: datetime | None = None
    attempt_limit: int | None = None
    show_answers: bool = True
    show_explanations: bool = True


class AssessmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    goal: str
    target_role: str
    difficulty: str
    question_count: int
    status: str
    created_at: datetime
    exam_mode: str
    deadline_at: datetime | None = None
    attempt_limit: int | None = None
    show_answers: bool
    show_explanations: bool
    question_total: int = 0
    question_approved: int = 0
    attempt_count: int = 0


class AssessmentDetail(AssessmentRead):
    document_ids: list[int] = Field(default_factory=list)
    questions: list[QuestionRead] = Field(default_factory=list)
