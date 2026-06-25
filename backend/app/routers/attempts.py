from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import Answer, Assessment, Attempt, Question, User
from ..schemas import AnswerSubmit
from ..schemas.attempt import (
    AnswerResult,
    AttemptQuestionView,
    AttemptRead,
    AttemptResult,
)
from ..services import gap_service, orchestrator_service, practice_generator, recommendation_service, scoring_service

router = APIRouter(prefix="/api/attempts", tags=["attempts"])


class StartAttempt(BaseModel):
    assessment_id: int


@router.post("", response_model=AttemptRead, status_code=status.HTTP_201_CREATED)
def start_attempt(
    payload: StartAttempt,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("employee", "manager", "admin")),
):
    a = db.get(Assessment, payload.assessment_id)
    if not a:
        raise HTTPException(404, "Assessment not found")
    if a.status != "published":
        raise HTTPException(400, "Assessment is not published")

    # Assessment Mode Orchestrator validations
    orchestrator_service.validate_start_attempt(db, user.id, a)

    # Reuse an in-progress attempt if one exists
    existing = db.scalar(
        select(Attempt).where(
            Attempt.assessment_id == a.id,
            Attempt.employee_id == user.id,
            Attempt.status == "in_progress",
        )
    )
    attempt = existing or Attempt(assessment_id=a.id, employee_id=user.id, status="in_progress")
    if existing is None:
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
    return _to_attempt_read(db, attempt)


def _to_attempt_read(db: Session, attempt: Attempt) -> AttemptRead:
    assessment = db.get(Assessment, attempt.assessment_id)
    questions = (
        db.execute(
            select(Question)
            .where(
                Question.assessment_id == attempt.assessment_id,
                Question.status == "approved",
            )
            .order_by(Question.id)
        )
        .scalars()
        .all()
    )
    saved = {
        a.question_id: a.answer_json
        for a in db.execute(
            select(Answer).where(Answer.attempt_id == attempt.id)
        ).scalars().all()
    }
    return AttemptRead(
        id=attempt.id,
        assessment_id=attempt.assessment_id,
        assessment_title=assessment.title if assessment else "",
        employee_id=attempt.employee_id,
        started_at=attempt.started_at,
        submitted_at=attempt.submitted_at,
        status=attempt.status,
        questions=[
            AttemptQuestionView(
                id=q.id,
                question_text=q.question_text,
                question_type=q.question_type,
                options_json=q.options_json,
                difficulty=q.difficulty,
            )
            for q in questions
        ],
        saved_answers=saved,
    )


@router.get("/{attempt_id}", response_model=AttemptRead)
def get_attempt(
    attempt_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    a = db.get(Attempt, attempt_id)
    if not a:
        raise HTTPException(404, "Attempt not found")
    if a.employee_id != user.id and user.role not in ("admin", "manager"):
        raise HTTPException(403, "Not your attempt")
    return _to_attempt_read(db, a)


@router.post("/{attempt_id}/answer", status_code=204)
def save_answer(
    attempt_id: int,
    payload: AnswerSubmit,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    a = db.get(Attempt, attempt_id)
    if not a:
        raise HTTPException(404, "Attempt not found")
    if a.employee_id != user.id:
        raise HTTPException(403, "Not your attempt")
    if a.status != "in_progress":
        raise HTTPException(400, "Attempt already submitted")
    q = db.get(Question, payload.question_id)
    if not q or q.assessment_id != a.assessment_id:
        raise HTTPException(404, "Question not in this attempt")

    existing = db.scalar(
        select(Answer).where(
            Answer.attempt_id == a.id, Answer.question_id == payload.question_id
        )
    )
    if existing:
        existing.answer_json = payload.answer_json
    else:
        db.add(
            Answer(
                attempt_id=a.id,
                question_id=payload.question_id,
                answer_json=payload.answer_json,
            )
        )
    db.commit()


@router.post("/{attempt_id}/submit", response_model=AttemptResult)
def submit_attempt(
    attempt_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    a = db.get(Attempt, attempt_id)
    if not a:
        raise HTTPException(404, "Attempt not found")
    if a.employee_id != user.id and user.role != "admin":
        raise HTTPException(403, "Not your attempt")
    # Assessment Mode Orchestrator validations
    orchestrator_service.validate_submit_attempt(db, a)

    if a.status == "submitted":
        return get_results(attempt_id, db, user)
    a.submitted_at = datetime.utcnow()
    try:
        scoring_service.score_attempt(db, a)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Scoring failed: {e}")
    return get_results(attempt_id, db, user)


@router.get("/{attempt_id}/results", response_model=AttemptResult)
def get_results(
    attempt_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    a = db.get(Attempt, attempt_id)
    if not a:
        raise HTTPException(404, "Attempt not found")
    if a.employee_id != user.id and user.role not in ("admin", "manager"):
        raise HTTPException(403, "Not your attempt")
    if a.status != "submitted":
        raise HTTPException(400, "Attempt not yet submitted")

    assessment = db.get(Assessment, a.assessment_id)
    answers = (
        db.execute(select(Answer).where(Answer.attempt_id == a.id)).scalars().all()
    )

    answer_results: list[AnswerResult] = []
    for ans in answers:
        q = db.get(Question, ans.question_id)
        if q is None:
            continue
        answer_results.append(
            AnswerResult(
                question_id=q.id,
                question_text=q.question_text,
                question_type=q.question_type,
                options_json=q.options_json,
                correct_answer_json=q.correct_answer_json,
                explanation=q.explanation,
                employee_answer=ans.answer_json,
                is_correct=ans.is_correct,
                score=ans.score,
                max_score=ans.max_score,
                ai_rationale=ans.ai_rationale,
                ai_evidence=ans.ai_evidence,
                knowledge_point_id=q.knowledge_point_id,
                knowledge_point_title=q.knowledge_point.title if q.knowledge_point else "",
            )
        )

    gaps = gap_service.compute_gaps(db, a)
    gaps = gap_service.summarize_gaps(db, a, gaps)

    pct = (a.total_score / a.max_score * 100.0) if a.max_score > 0 else 0.0
    recommendation = recommendation_service.generate_recommendations(
        db, a, gaps, pct
    )
    # Redact answers if in Assessment Mode for employees
    if assessment:
        answer_results = orchestrator_service.redact_results_if_needed(assessment, answer_results, user.role)

    return AttemptResult(
        attempt_id=a.id,
        assessment_title=assessment.title if assessment else "",
        exam_mode=assessment.exam_mode if assessment else "practice",
        total_score=a.total_score,
        max_score=a.max_score,
        percent=round(pct, 1),
        submitted_at=a.submitted_at,
        answers=answer_results,
        gaps=gaps,
        recommendation=recommendation,
    )


@router.post("/{attempt_id}/generate-practice")
def generate_practice(
    attempt_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    a = db.get(Attempt, attempt_id)
    if not a:
        raise HTTPException(404, "Attempt not found")
    if a.employee_id != user.id and user.role != "admin":
        raise HTTPException(403, "Not your attempt")
    
    try:
        custom_assessment_id = practice_generator.generate_adaptive_practice(db, attempt_id)
        return {"assessment_id": custom_assessment_id}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Practice generation failed: {e}")


class AnswerOverride(BaseModel):
    score: float
    is_correct: bool
    ai_rationale: str | None = None


@router.patch("/{attempt_id}/answers/{question_id}/override")
def override_answer_score(
    attempt_id: int,
    question_id: int,
    payload: AnswerOverride,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("manager", "admin")),
):
    ans = db.scalar(
        select(Answer).where(
            Answer.attempt_id == attempt_id,
            Answer.question_id == question_id
        )
    )
    if not ans:
        raise HTTPException(404, "Scored answer not found")
        
    ans.score = payload.score
    ans.is_correct = payload.is_correct
    if payload.ai_rationale is not None:
        ans.ai_rationale = payload.ai_rationale
        
    db.commit()
    
    # Recalculate attempt total score
    attempt = db.get(Attempt, attempt_id)
    if attempt:
        answers = db.execute(
            select(Answer).where(Answer.attempt_id == attempt_id)
        ).scalars().all()
        attempt.total_score = round(sum(a.score for a in answers), 2)
        db.commit()
        
    return {"status": "success"}
