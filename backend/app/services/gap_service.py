"""Knowledge gap analysis — the headline feature.

Aggregates wrong/low-scored answers by knowledge_point_id, then asks a
cheap model to label each gap with a human-readable theme.
"""

from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..ai import prompts, tools
from ..ai.client import call_tool
from ..config import settings
from ..models import Answer, Assessment, Attempt, Document, KnowledgePoint, Question
from ..schemas.attempt import KnowledgeGap

logger = logging.getLogger("kvp.gaps")

THRESHOLD_HIGH = 0.4  # avg score below this → high severity
THRESHOLD_MEDIUM = 0.7


def _severity(avg_score: float) -> str:
    if avg_score < THRESHOLD_HIGH:
        return "high"
    if avg_score < THRESHOLD_MEDIUM:
        return "medium"
    return "low"


def compute_gaps(db: Session, attempt: Attempt) -> list[KnowledgeGap]:
    """Walk answers → questions → KPs → documents and aggregate."""
    rows = db.execute(
        select(
            KnowledgePoint.id,
            KnowledgePoint.title,
            Document.title,
            func.count(Answer.id),
            func.avg(Answer.score),
        )
        .join(Question, Question.knowledge_point_id == KnowledgePoint.id)
        .join(Answer, Answer.question_id == Question.id)
        .join(Document, Document.id == KnowledgePoint.document_id)
        .where(Answer.attempt_id == attempt.id)
        .group_by(KnowledgePoint.id, KnowledgePoint.title, Document.title)
    ).all()

    # Separate query for "wrong count" — avoids dialect-specific boolean-sum casts.
    wrong_counts = dict(
        db.execute(
            select(Question.knowledge_point_id, func.count(Answer.id))
            .join(Question, Question.id == Answer.question_id)
            .where(Answer.attempt_id == attempt.id, Answer.is_correct == False)  # noqa: E712
            .group_by(Question.knowledge_point_id)
        ).all()
    )

    gaps: list[KnowledgeGap] = []
    for kp_id, kp_title, doc_title, total, avg_score in rows:
        avg = float(avg_score or 0.0)
        wrong = int(wrong_counts.get(kp_id, 0))
        if avg >= THRESHOLD_MEDIUM and wrong == 0:
            continue  # not a gap
        gaps.append(
            KnowledgeGap(
                knowledge_point_id=kp_id,
                knowledge_point_title=kp_title,
                document_title=doc_title,
                questions_total=int(total),
                questions_wrong=wrong,
                avg_score=round(avg, 2),
                severity=_severity(avg),
            )
        )

    return gaps


def summarize_gaps(
    db: Session, attempt: Attempt, gaps: list[KnowledgeGap]
) -> list[KnowledgeGap]:
    """Add AI-generated theme summaries to each gap. Uses Haiku for cost."""
    if not gaps:
        return gaps

    # Pull KP descriptions for the prompt
    kp_ids = [g.knowledge_point_id for g in gaps]
    kps = {
        kp.id: kp
        for kp in db.execute(
            select(KnowledgePoint).where(KnowledgePoint.id.in_(kp_ids))
        ).scalars().all()
    }
    assessment = db.get(Assessment, attempt.assessment_id)
    target_role = assessment.target_role if assessment else "employee"

    payload = [
        {
            "id": g.knowledge_point_id,
            "title": g.knowledge_point_title,
            "description": kps[g.knowledge_point_id].description if g.knowledge_point_id in kps else "",
            "questions_wrong": g.questions_wrong,
            "questions_total": g.questions_total,
            "avg_score": g.avg_score,
        }
        for g in gaps
    ]

    try:
        result = call_tool(
            model=settings.MODEL_LIGHT,
            system=prompts.GAP_SUMMARY_SYSTEM,
            user_content=prompts.gap_summary_user_message(target_role, payload),
            tool_name="summarize_gaps",
            tool_schema=tools.SUMMARIZE_GAPS_SCHEMA,
            max_tokens=1200,
        )
        summaries = {
            s["knowledge_point_id"]: s["summary"] for s in result.get("gaps", [])
        }
        for g in gaps:
            g.summary = summaries.get(g.knowledge_point_id, "")
    except Exception as e:  # noqa: BLE001
        logger.warning("gap summarization failed (continuing without): %s", e)

    return gaps
