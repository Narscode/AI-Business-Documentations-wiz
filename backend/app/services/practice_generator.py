"""AI Adaptive Practice Generator.

Reads an employee's incorrect answers, identifies the weak Knowledge Points,
generates a custom Practice Assessment with similar but new questions,
and links them in the database for immediate review.
"""

import logging
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai.client import call_tool
from ..ai import prompts, tools
from ..config import settings
from ..models import Assessment, Attempt, Answer, Question, KnowledgePoint

logger = logging.getLogger("kvp.practice_generator")


def generate_adaptive_practice(db: Session, attempt_id: int) -> int:
    """Creates a new custom practice assessment and returns its ID."""
    attempt = db.get(Attempt, attempt_id)
    if not attempt:
        raise ValueError("Attempt not found.")

    original_assessment = db.get(Assessment, attempt.assessment_id)
    if not original_assessment:
        raise ValueError("Original assessment not found.")

    # 1. Fetch incorrect answers and their related Knowledge Points
    wrong_answers = db.execute(
        select(Answer)
        .join(Question, Question.id == Answer.question_id)
        .where(Answer.attempt_id == attempt.id, Answer.is_correct == False)  # noqa: E712
    ).scalars().all()

    if not wrong_answers:
        # Fallback: if they got everything right, just pick the first few questions
        wrong_answers = db.execute(
            select(Answer).where(Answer.attempt_id == attempt.id)
        ).scalars().all()[:2]

    # Map to Knowledge Points
    kp_ids = []
    failed_questions = []
    for ans in wrong_answers:
        q = db.get(Question, ans.question_id)
        if q and q.knowledge_point_id:
            kp_ids.append(q.knowledge_point_id)
            failed_questions.append(q)

    kp_ids = list(set(kp_ids))
    if not kp_ids:
        raise ValueError("No knowledge points associated with incorrect answers.")

    kps = db.execute(select(KnowledgePoint).where(KnowledgePoint.id.in_(kp_ids))).scalars().all()

    # 2. Create the custom Practice Assessment
    custom_assessment = Assessment(
        title=f"Adaptive Practice - {original_assessment.title[:200]}",
        goal=f"Reinforcement practice for {original_assessment.title} focus areas.",
        target_role=original_assessment.target_role,
        difficulty=original_assessment.difficulty,
        question_count=len(kps),
        status="published",  # Auto-publish so they can take it immediately
        created_by_id=original_assessment.created_by_id,
        exam_mode="practice",
        show_answers=True,
        show_explanations=True
    )
    db.add(custom_assessment)
    db.flush()  # gets id

    # Link same documents
    custom_assessment.documents = original_assessment.documents

    # 3. Call LLM to generate questions or fallback
    system_prompt = (
        "You are an expert capability assessment designer. Generate a set of practice questions "
        "specifically targeted at helping an employee master concepts they previously got wrong. "
        "For each knowledge point, output exactly one question (MCQ, True/False, or Open Ended)."
    )

    prompt_user = "Generate similar but new questions for these weak areas:\n\n"
    for kp in kps:
        prompt_user += f"- Knowledge Point: {kp.title}\nDescription: {kp.description}\n\n"
    prompt_user += "\nOriginal questions missed (for reference, do not copy verbatim):\n"
    for q in failed_questions:
        prompt_user += f"- Missed Question: {q.question_text}\n"

    QUESTIONS_SCHEMA = {
        "type": "object",
        "properties": {
            "questions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "question_text": {"type": "string"},
                        "question_type": {"type": "string", "enum": ["mcq", "tf", "open"]},
                        "options_json": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Required for mcq, list of options"
                        },
                        "correct_answer_json": {"type": "string", "description": "Correct option string or true/false, or model answer for open-ended"},
                        "explanation": {"type": "string"},
                        "knowledge_point_id": {"type": "integer"}
                    },
                    "required": ["question_text", "question_type", "correct_answer_json", "explanation"]
                }
            }
        },
        "required": ["questions"]
    }

    try:
        # We need to map kp ids in the tool return, we'll ask it to set them
        # Let's map it explicitly in the user payload to help the LLM
        mapping_inst = "Make sure each item in your return maps back to one of the following knowledge point IDs: " + str({kp.title: kp.id for kp in kps})
        result = call_tool(
            model=settings.MODEL_HEAVY,
            system=system_prompt,
            user_content=prompt_user + "\
" + mapping_inst,
            tool_name="generate_questions",
            tool_schema=QUESTIONS_SCHEMA,
            max_tokens=2000
        )
        
        for q_data in result.get("questions", []):
            # Resolve knowledge point id
            kp_id = q_data.get("knowledge_point_id")
            if not kp_id or kp_id not in kp_ids:
                kp_id = kp_ids[0]  # default fallback
                
            q = Question(
                assessment_id=custom_assessment.id,
                knowledge_point_id=kp_id,
                question_text=q_data["question_text"],
                question_type=q_data["question_type"],
                options_json=q_data.get("options_json"),
                correct_answer_json=q_data["correct_answer_json"],
                explanation=q_data["explanation"],
                difficulty=original_assessment.difficulty,
                status="approved"  # Auto-approve practice questions
            )
            db.add(q)
            
    except Exception as e:
        logger.warning("Adaptive practice generation failed, using fallback: %s", e)
        
        # Fallback: create mock reinforcement questions based on the weak Knowledge Points
        for kp in kps:
            q = Question(
                assessment_id=custom_assessment.id,
                knowledge_point_id=kp.id,
                question_text=f"Practice check: Explain the key guidelines regarding '{kp.title}' in your own words.",
                question_type="open",
                correct_answer_json=f"Model answer details matching: {kp.description[:100]}",
                explanation=f"Ensure your response covers: {kp.description}",
                difficulty=original_assessment.difficulty,
                status="approved"
            )
            db.add(q)
            
    db.commit()
    return custom_assessment.id
