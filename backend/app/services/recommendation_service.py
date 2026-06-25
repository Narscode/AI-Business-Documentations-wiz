"""AI-generated personalized learning recommendations.

Runs after scoring, takes the gap analysis + the questions the employee got
right, and produces an actionable plan grounded in the available documents.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai import prompts, tools
from ..ai.client import call_tool
from ..config import settings
from ..models import Answer, Assessment, Attempt, KnowledgePoint, Question
from ..schemas.attempt import KnowledgeGap, LearningRecommendation

logger = logging.getLogger("kvp.recommendations")


def generate_recommendations(
    db: Session,
    attempt: Attempt,
    gaps: list[KnowledgeGap],
    percent: float,
) -> LearningRecommendation | None:
    """Build a personalized study plan. Returns None on AI failure (non-fatal)."""
    assessment = db.get(Assessment, attempt.assessment_id)
    if assessment is None:
        return None

    # Strengths: KPs the employee got fully right
    strengths_rows = db.execute(
        select(KnowledgePoint.id, KnowledgePoint.title)
        .join(Question, Question.knowledge_point_id == KnowledgePoint.id)
        .join(Answer, Answer.question_id == Question.id)
        .where(Answer.attempt_id == attempt.id, Answer.is_correct == True)  # noqa: E712
        .distinct()
        .limit(8)
    ).all()
    strengths = [{"id": kp_id, "title": title} for kp_id, title in strengths_rows]

    # Available documents (source docs for this assessment)
    doc_titles = [d.title for d in assessment.documents]

    gap_payload = [
        {
            "title": g.knowledge_point_title,
            "severity": g.severity,
            "avg_score": g.avg_score,
            "summary": g.summary or "(no summary available)",
        }
        for g in gaps
    ]

    try:
        result = call_tool(
            model=settings.MODEL_LIGHT,
            system=prompts.RECOMMEND_SYSTEM,
            user_content=prompts.recommend_user_message(
                target_role=assessment.target_role,
                assessment_title=assessment.title,
                percent_score=percent,
                gaps=gap_payload,
                strengths=strengths,
                documents=doc_titles,
            ),
            tool_name="recommend_learning",
            tool_schema=tools.RECOMMEND_LEARNING_SCHEMA,
            max_tokens=1500,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("recommendation generation failed: %s", e)
        return None

    return LearningRecommendation(
        weak_topics=result.get("weak_topics", [])[:4],
        next_steps=result.get("next_steps", [])[:5],
        suggested_resources=[
            {
                "document_title": r.get("document_title", ""),
                "focus_area": r.get("focus_area", ""),
            }
            for r in result.get("suggested_resources", [])[:3]
        ],
        encouragement=result.get("encouragement", ""),
    )
