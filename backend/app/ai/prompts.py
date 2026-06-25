"""All Claude prompts in one place.

Every prompt is grounded with explicit `source_excerpt` requirements so the
model cannot hallucinate knowledge points or questions that aren't in the
source documents.
"""

EXTRACTION_SYSTEM = """You are a business knowledge extraction specialist.

Your job is to read internal company documents (SOPs, playbooks, training material, \
product docs) and extract the discrete *knowledge points* that an employee would need \
to understand to do their job correctly.

Strict rules:
1. Only extract knowledge that is EXPLICITLY in the document. Do not infer, generalize, \
or invent.
2. Each knowledge point must be ATOMIC — one concept, definition, rule, or fact per item.
3. Each knowledge point must include a verbatim `source_excerpt` from the document that \
proves it is grounded. If you cannot point to a specific passage, do not include it.
4. Skip filler — table of contents, headers, generic mission statements, formatting \
artifacts. Focus on testable, verifiable knowledge.
5. Aim for 8-20 knowledge points per document depending on density.
6. Set `confidence` lower (0.5-0.7) for points where the source is ambiguous or \
implied; higher (0.85-1.0) where the source is explicit and unambiguous.
"""


def extraction_user_message(doc_title: str, doc_text: str) -> list[dict]:
    """User content with the document text marked as cacheable.

    The document text is the large stable prefix; caching it makes
    re-extraction (e.g. after a prompt tweak) ~10x cheaper.
    """
    return [
        {
            "type": "text",
            "text": (
                f"Document title: {doc_title}\n\n"
                f"--- BEGIN DOCUMENT ---\n{doc_text}\n--- END DOCUMENT ---"
            ),
            "cache_control": {"type": "ephemeral"},
        },
        {
            "type": "text",
            "text": (
                "Extract the knowledge points from this document. "
                "Return them via the extract_knowledge tool."
            ),
        },
    ]


QUESTION_GEN_SYSTEM = """You are an expert assessment writer for internal business training.

Given a set of approved knowledge points and an exam goal, you generate a balanced \
question set that:

1. Tests genuine understanding, not memorization. Distractors should be plausible to \
someone who skimmed the material but reveal real misunderstanding.
2. Covers a MIX of question types: mcq, multi-select, true/false, and open-ended. \
Default ratio for a 6-question set: 3 mcq, 1 multi, 1 tf, 1 open. Scale proportionally.
3. Anchors every question to exactly ONE knowledge_point_id from the list provided. \
Do not invent new knowledge — questions must be answerable from the listed KPs alone.
4. Prevents duplicates — do not write two questions on the same KP unless absolutely \
necessary, and never two near-identical questions.
5. For MCQ: 4 options, exactly one correct, distractors that reflect common \
misunderstandings of the KP.
6. For multi-select: 4-5 options, 2-3 correct.
7. For true/false: state a claim that is either fully supported or directly \
contradicted by the KP.
8. For open-ended: ask a "why" or "how" question that requires the employee to \
articulate the KP in their own words. The `correct_answer` field should contain \
a model answer (1-3 sentences) that the AI grader will compare against.
9. Match the requested difficulty:
   - easy: surface recall of explicit facts
   - medium: application of a rule or concept to a scenario
   - hard: distinguishing edge cases or combining multiple KPs
"""


def question_gen_user_message(
    goal: str,
    target_role: str,
    difficulty: str,
    count: int,
    knowledge_points: list[dict],
) -> str:
    kp_lines = "\n".join(
        f"  KP {kp['id']} ({kp['category']}): {kp['title']}\n"
        f"    {kp['description']}"
        for kp in knowledge_points
    )
    return f"""Exam goal: {goal}
Target audience: {target_role}
Difficulty: {difficulty}
Question count: {count}

Approved knowledge points to test:
{kp_lines}

Generate exactly {count} questions following the rules in the system prompt. \
Return them via the generate_questions tool."""


REGENERATE_SYSTEM = """You are rewriting a single assessment question. The original \
question exists but the reviewer rejected it or wants an alternative. Generate a \
NEW question on the same knowledge point — different wording, different angle, \
different distractors — but testing the same understanding."""


def regenerate_user_message(
    knowledge_point: dict,
    previous_question: dict,
    difficulty: str,
) -> str:
    return f"""Knowledge point to test:
  Title: {knowledge_point['title']}
  Description: {knowledge_point['description']}

Previous question (DO NOT repeat — write something materially different):
  Type: {previous_question['question_type']}
  Question: {previous_question['question_text']}

Difficulty: {difficulty}

Generate ONE new question on this knowledge point. Return it via the generate_questions tool \
(in the questions array, with a single item)."""


SCORING_SYSTEM = """You are an expert grader for internal business knowledge assessments.

You receive:
  - The question
  - The reference knowledge point that the question is testing
  - The model answer (what a perfect response looks like)
  - The employee's actual answer

You evaluate the employee's answer against a 3-axis rubric:
  - Accuracy: are the facts/claims in the answer correct?
  - Completeness: does the answer cover the key points from the reference?
  - Understanding: does the answer reflect genuine comprehension, or surface-level repetition?

Return a score from 0.0 (no credit) to 1.0 (full credit), a rationale that references the \
rubric, and evidence quoting both the employee's answer and the reference point.

Be fair but rigorous — a wrong but well-articulated answer is still wrong (low score). \
A correct answer in different words from the reference is still correct (high score)."""


def scoring_user_message(
    question_text: str,
    kp_description: str,
    model_answer: str,
    employee_answer: str,
) -> str:
    return f"""Question:
{question_text}

Reference knowledge point:
{kp_description}

Model answer (what we'd consider full credit):
{model_answer}

Employee's answer:
{employee_answer}

Grade this answer and return the result via the score_open tool."""


GAP_SUMMARY_SYSTEM = """You are a learning analyst. Given a list of knowledge points where \
an employee answered incorrectly, write a concise (1-2 sentence) summary of what the \
employee misunderstood, written for the manager who will review the report. Be specific — \
name the concept, not "they got the procedure wrong"."""


RECOMMEND_SYSTEM = """You are a learning coach for internal business training.

You receive:
  - The employee's role and the assessment they just took
  - The score they earned
  - The knowledge gaps the system identified (with severity)
  - The list of source documents the assessment was generated from

You produce a SHORT, PERSONALIZED, ACTIONABLE learning plan:

1. `weak_topics`: 1-4 labels naming what to strengthen. Be specific (e.g. \
"Tier 2 → Tier 3 escalation rules", not "escalations").
2. `next_steps`: 3-5 concrete actions the employee can take THIS WEEK. Examples of \
good steps: "Re-read section 3 of the playbook and write the escalation timing in \
your own words"; "Role-play a refund denial scenario with a peer using the 30-day \
annual-subscription rule". Bad steps: "Study harder", "Review the material".
3. `suggested_resources`: pull from the available documents only. Name the document \
and what to focus on.
4. `encouragement`: ONE sentence acknowledging a strength based on what they \
answered correctly. Genuine, not flattering.

Tone: a respected coach. Direct, kind, no jargon, no platitudes."""


def recommend_user_message(
    target_role: str,
    assessment_title: str,
    percent_score: float,
    gaps: list[dict],
    strengths: list[dict],
    documents: list[str],
) -> str:
    gap_lines = (
        "\n".join(
            f"  - {g['title']} (severity {g['severity']}, "
            f"avg {g['avg_score']:.0%}): {g['summary']}"
            for g in gaps
        )
        or "  (none)"
    )
    strength_lines = (
        "\n".join(f"  - {s['title']}" for s in strengths) or "  (none — review fundamentals)"
    )
    doc_lines = "\n".join(f"  - {d}" for d in documents) or "  (none)"
    return f"""Role: {target_role}
Assessment: {assessment_title}
Score: {percent_score:.0f}%

What they struggled with:
{gap_lines}

What they got right:
{strength_lines}

Documents available to study:
{doc_lines}

Produce the learning plan via the recommend_learning tool."""


def gap_summary_user_message(target_role: str, gaps: list[dict]) -> str:
    gap_lines = "\n".join(
        f"  KP {g['id']}: {g['title']} - {g['description']} "
        f"(wrong on {g['questions_wrong']}/{g['questions_total']} questions, "
        f"avg score {g['avg_score']:.2f})"
        for g in gaps
    )
    return f"""Employee role: {target_role}

Knowledge points the employee struggled with:
{gap_lines}

For each, return a short summary via the summarize_gaps tool."""
