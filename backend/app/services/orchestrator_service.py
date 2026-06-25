"""Assessment Mode Orchestrator.

Enforces mode-specific rules (Practice vs Assessment), attempt limits,
deadlines, and answer visibility constraints.
"""

from datetime import datetime
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Assessment, Attempt


def validate_start_attempt(db: Session, user_id: int, assessment: Assessment) -> None:
    # 1. Check if deadline has passed
    if assessment.deadline_at and datetime.utcnow() > assessment.deadline_at:
        raise HTTPException(400, "The deadline for this assessment has passed.")

    # 2. If assessment mode, enforce attempt limits (strictly 1 attempt)
    if assessment.exam_mode == "assessment":
        existing = db.execute(
            select(Attempt).where(
                Attempt.assessment_id == assessment.id,
                Attempt.employee_id == user_id
            )
        ).scalars().all()
        
        # If they already have any attempt (submitted or in-progress)
        if existing:
            # Check if there is an in-progress attempt they can resume
            in_progress = [att for att in existing if att.status == "in_progress"]
            if in_progress:
                return  # Let them resume the existing in-progress attempt
            
            # If all attempts are submitted, block starting a new one
            raise HTTPException(400, "You have already taken this assessment. Only one attempt is permitted.")


def validate_submit_attempt(db: Session, attempt: Attempt) -> None:
    assessment = db.get(Assessment, attempt.assessment_id)
    if not assessment:
        return
        
    # Check deadline on submission
    if assessment.deadline_at and datetime.utcnow() > assessment.deadline_at:
        raise HTTPException(400, "Cannot submit: The deadline for this assessment has passed.")


def redact_results_if_needed(assessment: Assessment, answers: list, user_role: str) -> list:
    """Strip correct answers, explanations, and AI scoring rationales in Assessment Mode."""
    if assessment.exam_mode == "assessment" and user_role == "employee":
        for ans in answers:
            ans.correct_answer_json = None
            ans.explanation = "Answers are hidden for formal assessments."
            ans.ai_rationale = "Scoring rationale is hidden for formal assessments."
            ans.ai_evidence = "Evidence is hidden for formal assessments."
    return answers
