from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import Assessment, Attempt, Document, Question, User
from ..schemas import AssessmentCreate, AssessmentDetail, AssessmentRead, CoverageReport, ManagerCompletion
from ..schemas.question import QuestionRead
from ..services import coverage_service, question_service, readiness_service

router = APIRouter(prefix="/api/assessments", tags=["assessments"])


def _enrich(db: Session, a: Assessment) -> AssessmentRead:
    q_total = (
        db.scalar(select(func.count(Question.id)).where(Question.assessment_id == a.id))
        or 0
    )
    q_appr = (
        db.scalar(
            select(func.count(Question.id)).where(
                Question.assessment_id == a.id, Question.status == "approved"
            )
        )
        or 0
    )
    attempts = (
        db.scalar(
            select(func.count(Attempt.id)).where(
                Attempt.assessment_id == a.id, Attempt.status == "submitted"
            )
        )
        or 0
    )
    return AssessmentRead(
        id=a.id,
        title=a.title,
        goal=a.goal,
        target_role=a.target_role,
        difficulty=a.difficulty,
        question_count=a.question_count,
        status=a.status,
        created_at=a.created_at,
        exam_mode=a.exam_mode,
        deadline_at=a.deadline_at,
        attempt_limit=a.attempt_limit,
        show_answers=a.show_answers,
        show_explanations=a.show_explanations,
        question_total=q_total,
        question_approved=q_appr,
        attempt_count=attempts,
    )


@router.get("", response_model=list[AssessmentRead])
def list_assessments(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    if user.role == "manager":
        stmt = select(Assessment).where(Assessment.created_by_id == user.id)
    elif user.role == "employee":
        stmt = select(Assessment).where(Assessment.status == "published")
    else:
        stmt = select(Assessment)
    rows = db.execute(stmt.order_by(Assessment.created_at.desc())).scalars().all()
    return [_enrich(db, a) for a in rows]


@router.get("/{assessment_id}", response_model=AssessmentDetail)
def get_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    a = db.get(Assessment, assessment_id)
    if not a:
        raise HTTPException(404, "Assessment not found")
    base = _enrich(db, a)
    questions = (
        db.execute(
            select(Question).where(Question.assessment_id == a.id).order_by(Question.id)
        )
        .scalars()
        .all()
    )
    q_reads: list[QuestionRead] = []
    for q in questions:
        kp_title = q.knowledge_point.title if q.knowledge_point else ""
        q_reads.append(
            QuestionRead(
                id=q.id,
                assessment_id=q.assessment_id,
                knowledge_point_id=q.knowledge_point_id,
                knowledge_point_title=kp_title,
                question_text=q.question_text,
                question_type=q.question_type,
                options_json=q.options_json,
                correct_answer_json=q.correct_answer_json,
                explanation=q.explanation,
                difficulty=q.difficulty,
                status=q.status,
                created_at=q.created_at,
            )
        )
    return AssessmentDetail(
        **base.model_dump(),
        document_ids=[d.id for d in a.documents],
        questions=q_reads,
    )


@router.post("", response_model=AssessmentRead, status_code=status.HTTP_201_CREATED)
def create_assessment(
    payload: AssessmentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("manager", "admin")),
):
    if not payload.document_ids:
        raise HTTPException(400, "Pick at least one source document")
    docs = (
        db.execute(select(Document).where(Document.id.in_(payload.document_ids)))
        .scalars()
        .all()
    )
    if len(docs) != len(set(payload.document_ids)):
        raise HTTPException(400, "One or more documents not found")
    a = Assessment(
        title=payload.title[:300],
        goal=payload.goal,
        target_role=payload.target_role[:120],
        difficulty=payload.difficulty,
        question_count=payload.question_count,
        status="draft",
        created_by_id=user.id,
        exam_mode=payload.exam_mode,
        deadline_at=payload.deadline_at,
        attempt_limit=payload.attempt_limit,
        show_answers=payload.show_answers,
        show_explanations=payload.show_explanations,
    )
    a.documents = docs
    db.add(a)
    db.commit()
    db.refresh(a)
    return _enrich(db, a)


@router.post("/{assessment_id}/generate", response_model=AssessmentDetail)
def generate_questions(
    assessment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("manager", "admin")),
):
    a = db.get(Assessment, assessment_id)
    if not a:
        raise HTTPException(404, "Assessment not found")
    if a.status == "published":
        raise HTTPException(400, "Cannot regenerate a published assessment")
    try:
        question_service.generate_questions(db, a)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Generation failed: {e}")
    return get_assessment(assessment_id, db)


@router.get("/{assessment_id}/coverage", response_model=CoverageReport)
def coverage(
    assessment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    a = db.get(Assessment, assessment_id)
    if not a:
        raise HTTPException(404, "Assessment not found")
    return coverage_service.compute_coverage(db, a)


@router.post("/{assessment_id}/publish", response_model=AssessmentRead)
def publish(
    assessment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("manager", "admin")),
):
    a = db.get(Assessment, assessment_id)
    if not a:
        raise HTTPException(404, "Assessment not found")
    approved = (
        db.scalar(
            select(func.count(Question.id)).where(
                Question.assessment_id == a.id, Question.status == "approved"
            )
        )
        or 0
    )
    if approved == 0:
        raise HTTPException(422, "Approve at least one question before publishing")
    a.status = "published"
    db.commit()
    db.refresh(a)
    return _enrich(db, a)


@router.get("/{assessment_id}/readiness")
def get_readiness(
    assessment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return readiness_service.predict_readiness(db, user.id, assessment_id)


@router.get("/{assessment_id}/attempts", response_model=list[ManagerCompletion])
def get_assessment_attempts(
    assessment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("manager", "admin")),
):
    a = db.get(Assessment, assessment_id)
    if not a:
        raise HTTPException(404, "Assessment not found")
    
    stmt = (
        select(Attempt)
        .where(
            Attempt.assessment_id == assessment_id,
            Attempt.status == "submitted"
        )
        .order_by(Attempt.submitted_at.desc())
    )
    attempts = db.execute(stmt).scalars().all()
    
    completions = []
    for att in attempts:
        emp = db.get(User, att.employee_id)
        if not emp:
            continue
        pct = (att.total_score / att.max_score * 100.0) if att.max_score > 0 else 0.0
        completions.append(
            ManagerCompletion(
                attempt_id=att.id,
                employee_name=emp.name,
                assessment_title=a.title,
                total_score=att.total_score,
                max_score=att.max_score,
                percent=round(pct, 1),
                submitted_at=att.submitted_at,
                exam_mode=a.exam_mode,
            )
        )
    return completions
