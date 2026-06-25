"""Scoring: deterministic for objective types, LLM-based for open-ended."""

from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai import prompts, tools
from ..ai.client import call_tool
from ..config import settings
from ..models import Answer, Attempt, Question

logger = logging.getLogger("kvp.scoring")


def _normalize_str(v) -> str:
    return str(v).strip().lower() if v is not None else ""


def _score_mcq(question: Question, answer) -> tuple[bool, float]:
    correct = question.correct_answer_json
    return (_normalize_str(answer) == _normalize_str(correct), 1.0)


def _score_multi(question: Question, answer) -> tuple[bool, float]:
    correct = question.correct_answer_json or []
    if not isinstance(correct, list):
        correct = [correct]
    given = answer if isinstance(answer, list) else [answer] if answer else []
    correct_norm = {_normalize_str(c) for c in correct}
    given_norm = {_normalize_str(g) for g in given}
    if not correct_norm:
        return False, 1.0
    # Partial credit: |intersection| / |union|, full credit only on exact match
    tp = len(correct_norm & given_norm)
    fp = len(given_norm - correct_norm)
    fn = len(correct_norm - given_norm)
    if fp == 0 and fn == 0:
        return True, 1.0
    if tp == 0:
        return False, 0.0
    # Jaccard
    score = tp / (tp + fp + fn)
    return False, round(score, 2)


def _score_tf(question: Question, answer) -> tuple[bool, float]:
    correct = bool(question.correct_answer_json)
    given = answer
    if isinstance(given, str):
        given = given.strip().lower() in ("true", "t", "yes", "1")
    return (bool(given) == correct, 1.0)


def score_objective(question: Question, answer) -> tuple[bool, float, float]:
    """Returns (is_correct, score, max_score)."""
    if question.question_type == "mcq":
        ok, _ = _score_mcq(question, answer)
        return ok, (1.0 if ok else 0.0), 1.0
    if question.question_type == "multi":
        ok, s = _score_multi(question, answer)
        return ok, s, 1.0
    if question.question_type == "tf":
        ok, _ = _score_tf(question, answer)
        return ok, (1.0 if ok else 0.0), 1.0
    raise ValueError(f"Not an objective question type: {question.question_type}")


def score_open(question: Question, answer: str) -> dict:
    """LLM-graded open answer. Returns {score, rationale, evidence}."""
    kp = question.knowledge_point
    if not answer or not answer.strip():
        return {
            "score": 0.0,
            "rationale": "No answer provided.",
            "evidence": "(empty response)",
        }
    return call_tool(
        model=settings.MODEL_HEAVY,
        system=prompts.SCORING_SYSTEM,
        user_content=prompts.scoring_user_message(
            question_text=question.question_text,
            kp_description=kp.description if kp else "",
            model_answer=str(question.correct_answer_json or ""),
            employee_answer=answer,
        ),
        tool_name="score_open",
        tool_schema=tools.SCORE_OPEN_SCHEMA,
        max_tokens=600,
    )


def score_attempt(db: Session, attempt: Attempt) -> Attempt:
    """Score every saved answer and finalize the attempt."""
    answers = db.execute(
        select(Answer).where(Answer.attempt_id == attempt.id)
    ).scalars().all()

    total = 0.0
    max_total = 0.0
    for ans in answers:
        q = db.get(Question, ans.question_id)
        if q is None:
            continue
        ans.max_score = 1.0
        max_total += 1.0
        if q.question_type == "open":
            try:
                result = score_open(q, str(ans.answer_json or ""))
                ans.score = float(result.get("score", 0.0))
                ans.is_correct = ans.score >= 0.7
                ans.ai_rationale = result.get("rationale", "")
                ans.ai_evidence = result.get("evidence", "")
            except Exception as e:  # noqa: BLE001
                logger.exception("open scoring failed for answer %s", ans.id)
                ans.score = 0.0
                ans.is_correct = False
                ans.ai_rationale = f"Scoring error: {e}"
        else:
            is_correct, score, max_s = score_objective(q, ans.answer_json)
            ans.is_correct = is_correct
            ans.score = score
            ans.max_score = max_s
        total += ans.score

    attempt.total_score = round(total, 2)
    attempt.max_score = round(max_total, 2)
    attempt.status = "submitted"
    attempt.submitted_at = datetime.utcnow()
    db.commit()
    db.refresh(attempt)
    return attempt
