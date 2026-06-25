from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class AnswerSubmit(BaseModel):
    question_id: int
    answer_json: Any


class AnswerResult(BaseModel):
    question_id: int
    question_text: str
    question_type: str
    options_json: list | None = None
    correct_answer_json: Any | None = None
    explanation: str
    employee_answer: Any | None = None
    is_correct: bool
    score: float
    max_score: float
    ai_rationale: str = ""
    ai_evidence: str = ""
    knowledge_point_id: int
    knowledge_point_title: str = ""


class AttemptQuestionView(BaseModel):
    """Question shape sent to employee during the exam (no answers leaked)."""

    id: int
    question_text: str
    question_type: str
    options_json: list | None = None
    difficulty: str


class AttemptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    assessment_id: int
    assessment_title: str = ""
    employee_id: int
    started_at: datetime
    submitted_at: datetime | None = None
    status: str
    questions: list[AttemptQuestionView] = []
    saved_answers: dict[int, Any] = {}


class KnowledgeGap(BaseModel):
    knowledge_point_id: int
    knowledge_point_title: str
    document_title: str
    questions_total: int
    questions_wrong: int
    avg_score: float
    severity: str  # high | medium | low
    summary: str = ""  # AI-summarized theme


class SuggestedResource(BaseModel):
    document_title: str
    focus_area: str


class LearningRecommendation(BaseModel):
    weak_topics: list[str] = []
    next_steps: list[str] = []
    suggested_resources: list[SuggestedResource] = []
    encouragement: str = ""


class AttemptResult(BaseModel):
    attempt_id: int
    assessment_title: str
    exam_mode: str = "practice"
    total_score: float
    max_score: float
    percent: float
    submitted_at: datetime | None
    answers: list[AnswerResult]
    gaps: list[KnowledgeGap]
    recommendation: LearningRecommendation | None = None
