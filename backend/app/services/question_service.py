"""AI question generation from approved knowledge points + exam goal."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai import prompts, tools
from ..ai.client import call_tool
from ..config import settings
from ..models import Assessment, KnowledgePoint, Question

logger = logging.getLogger("kvp.questions")


def _normalize_question_payload(q: dict[str, Any]) -> dict[str, Any]:
    """Coerce LLM output into the shape stored on the Question model."""
    qtype = q.get("question_type", "mcq")
    options = q.get("options")
    correct = q.get("correct_answer")

    if qtype == "tf":
        options = ["True", "False"]
        if isinstance(correct, str):
            correct = correct.lower() in ("true", "t", "yes", "1")
        correct = bool(correct)
    elif qtype == "mcq":
        if not isinstance(options, list) or len(options) < 2:
            raise ValueError("mcq question missing options")
        # correct should be a single string in options
    elif qtype == "multi":
        if not isinstance(options, list) or len(options) < 2:
            raise ValueError("multi question missing options")
        if not isinstance(correct, list):
            correct = [correct] if correct is not None else []
    elif qtype == "open":
        options = None
        # correct stays as a model-answer string

    return {
        "question_type": qtype,
        "question_text": q["question_text"],
        "options_json": options,
        "correct_answer_json": correct,
        "explanation": q.get("explanation", ""),
        "difficulty": q.get("difficulty", "medium"),
    }


def generate_questions(db: Session, assessment: Assessment) -> list[Question]:
    """Generate the full question pool for an assessment."""
    # Approved KPs from the source documents
    doc_ids = [d.id for d in assessment.documents]
    if not doc_ids:
        raise ValueError("Assessment has no source documents.")

    kps = db.execute(
        select(KnowledgePoint).where(
            KnowledgePoint.document_id.in_(doc_ids),
            KnowledgePoint.status.in_(("approved", "edited")),
        )
    ).scalars().all()

    if not kps:
        raise ValueError(
            "No approved knowledge points yet — review and approve KPs first."
        )

    kp_payload = [
        {
            "id": kp.id,
            "title": kp.title,
            "description": kp.description,
            "category": "knowledge_point",
        }
        for kp in kps
    ]
    kp_by_id = {kp.id: kp for kp in kps}

    result = call_tool(
        model=settings.MODEL_HEAVY,
        system=prompts.QUESTION_GEN_SYSTEM,
        user_content=prompts.question_gen_user_message(
            goal=assessment.goal,
            target_role=assessment.target_role,
            difficulty=assessment.difficulty,
            count=assessment.question_count,
            knowledge_points=kp_payload,
        ),
        tool_name="generate_questions",
        tool_schema=tools.GENERATE_QUESTIONS_SCHEMA,
        max_tokens=8000,
    )

    created: list[Question] = []
    for raw in result.get("questions", []):
        kp_id = raw.get("knowledge_point_id")
        if kp_id not in kp_by_id:
            logger.warning("question references unknown KP %s, skipping", kp_id)
            continue
        try:
            payload = _normalize_question_payload(raw)
        except ValueError as e:
            logger.warning("malformed question, skipping: %s", e)
            continue
        q = Question(
            assessment_id=assessment.id,
            knowledge_point_id=kp_id,
            status="pending",
            **payload,
        )
        db.add(q)
        created.append(q)

    db.commit()
    for q in created:
        db.refresh(q)
    return created


def regenerate_question(db: Session, question: Question) -> Question:
    """Rewrite a single question on the same KP, different angle."""
    kp = db.get(KnowledgePoint, question.knowledge_point_id)
    if kp is None:
        raise ValueError("Question has no knowledge point.")

    previous = {
        "question_type": question.question_type,
        "question_text": question.question_text,
    }

    result = call_tool(
        model=settings.MODEL_HEAVY,
        system=prompts.REGENERATE_SYSTEM,
        user_content=prompts.regenerate_user_message(
            knowledge_point={"title": kp.title, "description": kp.description},
            previous_question=previous,
            difficulty=question.difficulty,
        ),
        tool_name="generate_questions",
        tool_schema=tools.GENERATE_QUESTIONS_SCHEMA,
        max_tokens=2000,
    )

    items = result.get("questions", [])
    if not items:
        raise RuntimeError("Regeneration returned no questions.")
    new_payload = _normalize_question_payload(items[0])

    for k, v in new_payload.items():
        setattr(question, k, v)
    question.status = "pending"
    db.commit()
    db.refresh(question)
    return question
