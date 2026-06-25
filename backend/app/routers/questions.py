from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import Question, User
from ..schemas.question import QuestionRead, QuestionUpdate
from ..services import question_service

router = APIRouter(prefix="/api/questions", tags=["questions"])


def _to_read(q: Question) -> QuestionRead:
    return QuestionRead(
        id=q.id,
        assessment_id=q.assessment_id,
        knowledge_point_id=q.knowledge_point_id,
        knowledge_point_title=q.knowledge_point.title if q.knowledge_point else "",
        question_text=q.question_text,
        question_type=q.question_type,
        options_json=q.options_json,
        correct_answer_json=q.correct_answer_json,
        explanation=q.explanation,
        difficulty=q.difficulty,
        status=q.status,
        created_at=q.created_at,
    )


@router.get("", response_model=list[QuestionRead])
def list_questions(
    assessment_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Question)
    if assessment_id is not None:
        stmt = stmt.where(Question.assessment_id == assessment_id)
    if status_filter:
        stmt = stmt.where(Question.status == status_filter)
    stmt = stmt.order_by(Question.id)
    return [_to_read(q) for q in db.execute(stmt).scalars().all()]


@router.patch("/{question_id}", response_model=QuestionRead)
def update_question(
    question_id: int,
    payload: QuestionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    q = db.get(Question, question_id)
    if not q:
        raise HTTPException(404, "Question not found")
    if payload.question_text is not None:
        q.question_text = payload.question_text
    if payload.options_json is not None:
        q.options_json = payload.options_json
    if payload.correct_answer_json is not None:
        q.correct_answer_json = payload.correct_answer_json
    if payload.explanation is not None:
        q.explanation = payload.explanation
    if payload.difficulty is not None:
        q.difficulty = payload.difficulty
    if payload.status is not None:
        q.status = payload.status
    db.commit()
    db.refresh(q)
    return _to_read(q)


@router.post("/{question_id}/regenerate", response_model=QuestionRead)
def regenerate(
    question_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    q = db.get(Question, question_id)
    if not q:
        raise HTTPException(404, "Question not found")
    try:
        q = question_service.regenerate_question(db, q)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Regeneration failed: {e}")
    return _to_read(q)
