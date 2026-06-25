"""AI Readiness Predictor.

Analyzes an employee's practice attempt scores and gap history, calls the LLM
to predict formal assessment readiness (Ready, Moderately Ready, Needs Preparation),
and provides a fallback mode if the gateway is offline.
"""

import logging
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai.client import call_tool
from ..config import settings
from ..models import Assessment, Attempt, Answer, Question, KnowledgePoint
from ..services import gap_service

logger = logging.getLogger("kvp.readiness")

READINESS_SCHEMA = {
    "type": "object",
    "properties": {
        "readiness": {"type": "string", "enum": ["Ready", "Moderately Ready", "Needs Preparation"]},
        "rationale": {"type": "string"}
    },
    "required": ["readiness", "rationale"]
}


def predict_readiness(db: Session, employee_id: int, assessment_id: int) -> dict:
    # 1. Fetch practice attempts for this assessment
    attempts = db.execute(
        select(Attempt)
        .where(Attempt.assessment_id == assessment_id, Attempt.employee_id == employee_id)
        .order_by(Attempt.started_at.asc())
    ).scalars().all()
    
    assessment = db.get(Assessment, assessment_id)
    if not assessment:
        return {"readiness": "Needs Preparation", "rationale": "Assessment not found."}

    # Extract score histories
    scores = []
    gap_points = []
    
    for att in attempts:
        if att.status == "submitted":
            pct = (att.total_score / att.max_score * 100.0) if att.max_score > 0 else 0.0
            scores.append(round(pct, 1))
            
            # Extract gaps for trends
            gaps = gap_service.compute_gaps(db, att)
            for g in gaps:
                gap_points.append(g.knowledge_point_title)

    if not scores:
        return {
            "readiness": "Needs Preparation",
            "rationale": "No practice attempts have been completed yet for this assessment. Taking practice exams is highly recommended before the formal evaluation."
        }

    # 2. Try calling LLM for prediction
    prompt_user = f"""
    Assessment Goal: {assessment.goal}
    Target Role: {assessment.target_role}
    Difficulty: {assessment.difficulty}

    Employee Practice Scores (in chronological order): {scores}
    Topics they struggled with (wrong answers): {list(set(gap_points))}
    """
    
    system_prompt = (
        "You are an expert capability readiness assessor. Analyze the practice history of the employee "
        "and determine if they are Ready, Moderately Ready, or Needs Preparation for the formal assessment. "
        "Output your judgment along with a constructive, brief reasoning summarizing their trends."
    )
    
    try:
        result = call_tool(
            model=settings.MODEL_LIGHT,
            system=system_prompt,
            user_content=prompt_user,
            tool_name="predict_readiness",
            tool_schema=READINESS_SCHEMA,
            max_tokens=300
        )
        return result
    except Exception as e:
        logger.warning("Readiness prediction LLM call failed, executing fallback: %s", e)
        
        # 3. Fallback: Deterministic scoring logic
        last_score = scores[-1]
        if last_score >= 80.0:
            readiness = "Ready"
            rationale = f"Based on your last practice attempt score of {last_score}%, you are well prepared for the formal evaluation."
        elif last_score >= 60.0:
            readiness = "Moderately Ready"
            rationale = f"Your last practice score of {last_score}% shows good comprehension, but reviewing your incorrect questions is recommended before formal testing."
        else:
            readiness = "Needs Preparation"
            rationale = f"Your latest practice score of {last_score}% is below the target threshold. Please take another practice attempt and review the study resources."
            
        return {"readiness": readiness, "rationale": rationale}
