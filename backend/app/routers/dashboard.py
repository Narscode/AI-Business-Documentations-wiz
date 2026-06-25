from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import Assessment, Attempt, Document, KnowledgePoint, Question, User
from ..schemas import (
    DashboardStats,
    EmployeeAttempt,
    EmployeeWeakTopic,
    EmployeeReadiness,
    EmployeeDashboardData,
    ManagerCompletion,
    ManagerGap,
    ManagerDashboardData,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(db: Session = Depends(get_db)) -> DashboardStats:
    docs = db.scalar(select(func.count(Document.id))) or 0
    kps = db.scalar(select(func.count(KnowledgePoint.id))) or 0
    kps_appr = db.scalar(
        select(func.count(KnowledgePoint.id)).where(
            KnowledgePoint.status.in_(("approved", "edited"))
        )
    ) or 0
    asmts = db.scalar(select(func.count(Assessment.id))) or 0
    asmts_pub = db.scalar(
        select(func.count(Assessment.id)).where(Assessment.status == "published")
    ) or 0
    employees_assessed = db.scalar(
        select(func.count(func.distinct(Attempt.employee_id))).where(
            Attempt.status == "submitted"
        )
    ) or 0
    q_total = db.scalar(select(func.count(Question.id))) or 0
    q_appr = db.scalar(
        select(func.count(Question.id)).where(Question.status == "approved")
    ) or 0
    return DashboardStats(
        documents_uploaded=docs,
        knowledge_points_extracted=kps,
        knowledge_points_approved=kps_appr,
        assessments_created=asmts,
        assessments_published=asmts_pub,
        employees_assessed=employees_assessed,
        questions_total=q_total,
        questions_approved=q_appr,
    )


@router.get("/employee", response_model=EmployeeDashboardData)
def employee_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
) -> EmployeeDashboardData:
    attempts = db.execute(
        select(Attempt)
        .where(Attempt.employee_id == user.id)
        .order_by(Attempt.started_at.desc())
    ).scalars().all()

    practice_attempts = []
    official_attempts = []
    weak_topics_dict = {}

    for att in attempts:
        asmt = db.get(Assessment, att.assessment_id)
        if not asmt:
            continue

        pct = (att.total_score / att.max_score * 100.0) if att.max_score > 0 else 0.0
        emp_att = EmployeeAttempt(
            attempt_id=att.id,
            assessment_id=att.assessment_id,
            assessment_title=asmt.title,
            total_score=att.total_score,
            max_score=att.max_score,
            percent=round(pct, 1),
            status=att.status,
            submitted_at=att.submitted_at
        )

        if asmt.exam_mode == "practice":
            practice_attempts.append(emp_att)
            if att.status == "submitted":
                from ..services import gap_service
                gaps = gap_service.compute_gaps(db, att)
                for g in gaps:
                    if g.knowledge_point_id not in weak_topics_dict:
                        weak_topics_dict[g.knowledge_point_id] = {
                            "title": g.knowledge_point_title,
                            "count": 0
                        }
                    weak_topics_dict[g.knowledge_point_id]["count"] += g.questions_wrong
        else:
            official_attempts.append(emp_att)

    weak_topics = [
        EmployeeWeakTopic(knowledge_point_id=k, title=v["title"], count=v["count"])
        for k, v in weak_topics_dict.items()
    ]
    weak_topics.sort(key=lambda x: x.count, reverse=True)

    published_asmts = db.execute(
        select(Assessment).where(Assessment.status == "published")
    ).scalars().all()

    readiness_predictions = []
    from ..services import readiness_service
    for asmt in published_asmts:
        pred = readiness_service.predict_readiness(db, user.id, asmt.id)
        readiness_predictions.append(
            EmployeeReadiness(
                assessment_id=asmt.id,
                assessment_title=asmt.title,
                readiness=pred.get("readiness", "Needs Preparation"),
                rationale=pred.get("rationale", "")
            )
        )

    return EmployeeDashboardData(
        practice_attempts=practice_attempts,
        official_attempts=official_attempts,
        weak_topics=weak_topics,
        readiness_predictions=readiness_predictions
    )


@router.get("/manager", response_model=ManagerDashboardData)
def manager_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("manager", "admin"))
) -> ManagerDashboardData:
    if user.role == "admin":
        stmt = select(Attempt).where(Attempt.status == "submitted")
    else:
        stmt = (
            select(Attempt)
            .join(Assessment, Attempt.assessment_id == Assessment.id)
            .where(
                Attempt.status == "submitted",
                Assessment.created_by_id == user.id
            )
        )
    attempts = db.execute(stmt.order_by(Attempt.submitted_at.desc())).scalars().all()

    completions = []
    gap_dist = {}

    for att in attempts:
        asmt = db.get(Assessment, att.assessment_id)
        emp = db.get(User, att.employee_id)
        if not asmt or not emp:
            continue

        pct = (att.total_score / att.max_score * 100.0) if att.max_score > 0 else 0.0
        completions.append(
            ManagerCompletion(
                attempt_id=att.id,
                employee_name=emp.name,
                assessment_title=asmt.title,
                total_score=att.total_score,
                max_score=att.max_score,
                percent=round(pct, 1),
                submitted_at=att.submitted_at,
                exam_mode=asmt.exam_mode
            )
        )

        from ..services import gap_service
        gaps = gap_service.compute_gaps(db, att)
        for g in gaps:
            if g.knowledge_point_title not in gap_dist:
                gap_dist[g.knowledge_point_title] = 0
            gap_dist[g.knowledge_point_title] += 1

    gap_distribution = [
        ManagerGap(knowledge_point_title=k, employee_count=v)
        for k, v in gap_dist.items()
    ]
    gap_distribution.sort(key=lambda x: x.employee_count, reverse=True)

    return ManagerDashboardData(
        completions=completions,
        gap_distribution=gap_distribution
    )
