"""Knowledge coverage: % of approved KPs in the source docs that are actually
tested by the assessment's questions.

Helps managers know whether critical business knowledge is being verified.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Assessment, KnowledgePoint, Question
from ..schemas.coverage import CoverageItem, CoverageReport


def compute_coverage(db: Session, assessment: Assessment) -> CoverageReport:
    doc_ids = [d.id for d in assessment.documents]
    if not doc_ids:
        return CoverageReport(
            assessment_id=assessment.id,
            total_kps=0,
            covered_kps=0,
            coverage_pct=0.0,
            covered=[],
            uncovered=[],
        )

    # All approved/edited KPs from the source docs
    kps = (
        db.execute(
            select(KnowledgePoint).where(
                KnowledgePoint.document_id.in_(doc_ids),
                KnowledgePoint.status.in_(("approved", "edited")),
            )
        )
        .scalars()
        .all()
    )

    # Count of approved questions per KP for this assessment
    question_counts = dict(
        db.execute(
            select(Question.knowledge_point_id, func.count(Question.id))
            .where(
                Question.assessment_id == assessment.id,
                Question.status == "approved",
            )
            .group_by(Question.knowledge_point_id)
        ).all()
    )

    covered: list[CoverageItem] = []
    uncovered: list[CoverageItem] = []
    for kp in kps:
        item = CoverageItem(
            knowledge_point_id=kp.id,
            knowledge_point_title=kp.title,
            question_count=int(question_counts.get(kp.id, 0)),
        )
        if item.question_count > 0:
            covered.append(item)
        else:
            uncovered.append(item)

    total = len(kps)
    pct = (len(covered) / total * 100.0) if total > 0 else 0.0
    return CoverageReport(
        assessment_id=assessment.id,
        total_kps=total,
        covered_kps=len(covered),
        coverage_pct=round(pct, 1),
        covered=covered,
        uncovered=uncovered,
    )
