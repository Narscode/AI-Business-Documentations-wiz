from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class QuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    assessment_id: int
    knowledge_point_id: int
    knowledge_point_title: str = ""
    question_text: str
    question_type: str
    options_json: list | None = None
    correct_answer_json: Any | None = None
    explanation: str
    difficulty: str
    status: str
    created_at: datetime


class QuestionUpdate(BaseModel):
    question_text: str | None = None
    options_json: list | None = None
    correct_answer_json: Any | None = None
    explanation: str | None = None
    difficulty: Literal["easy", "medium", "hard"] | None = None
    status: Literal["pending", "approved", "rejected"] | None = None
