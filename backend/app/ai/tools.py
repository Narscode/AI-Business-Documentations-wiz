"""JSON-schema tool definitions for structured Claude output.

These schemas are the contract between the LLM and the database — every
field is mirrored in the SQLAlchemy models / Pydantic schemas.
"""

EXTRACT_KNOWLEDGE_SCHEMA = {
    "type": "object",
    "properties": {
        "knowledge_points": {
            "type": "array",
            "description": (
                "Discrete, atomic knowledge points extracted from the document. "
                "Each must be self-contained and verifiable from the source."
            ),
            "items": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Short label (3-10 words) naming the knowledge point.",
                    },
                    "description": {
                        "type": "string",
                        "description": (
                            "Full statement of the knowledge point in 1-3 sentences. "
                            "Must be specific enough that a question can be written from it."
                        ),
                    },
                    "source_excerpt": {
                        "type": "string",
                        "description": (
                            "A verbatim or near-verbatim excerpt from the document "
                            "(20-200 chars) that grounds this knowledge point. "
                            "Do not paraphrase; copy from the source."
                        ),
                    },
                    "confidence": {
                        "type": "number",
                        "description": "Confidence 0.0-1.0 that this is a real, useful knowledge point.",
                    },
                    "category": {
                        "type": "string",
                        "enum": [
                            "concept",
                            "definition",
                            "procedure",
                            "policy",
                            "business_rule",
                            "key_fact",
                        ],
                        "description": "Type of knowledge.",
                    },
                },
                "required": ["title", "description", "source_excerpt", "confidence", "category"],
            },
        }
    },
    "required": ["knowledge_points"],
}


GENERATE_QUESTIONS_SCHEMA = {
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "knowledge_point_id": {
                        "type": "integer",
                        "description": "The DB id of the knowledge point this question tests.",
                    },
                    "question_type": {
                        "type": "string",
                        "enum": ["mcq", "multi", "tf", "open"],
                        "description": (
                            "mcq = single-correct multiple choice (4 options); "
                            "multi = multi-select (2+ correct); "
                            "tf = true/false; "
                            "open = open-ended written answer."
                        ),
                    },
                    "question_text": {"type": "string"},
                    "options": {
                        "type": "array",
                        "description": (
                            "For mcq/multi: 3-5 plausible options including the correct answer(s) "
                            "and meaningful distractors. For tf: omit. For open: omit."
                        ),
                        "items": {"type": "string"},
                    },
                    "correct_answer": {
                        "description": (
                            "For mcq: the correct option string. "
                            "For multi: array of correct option strings. "
                            "For tf: boolean true or false. "
                            "For open: a model answer string (1-3 sentences) capturing the key points."
                        )
                    },
                    "explanation": {
                        "type": "string",
                        "description": "Why the correct answer is right; cite the knowledge point.",
                    },
                    "difficulty": {
                        "type": "string",
                        "enum": ["easy", "medium", "hard"],
                    },
                },
                "required": [
                    "knowledge_point_id",
                    "question_type",
                    "question_text",
                    "correct_answer",
                    "explanation",
                    "difficulty",
                ],
            },
        }
    },
    "required": ["questions"],
}


SCORE_OPEN_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {
            "type": "number",
            "description": "Score between 0.0 (no credit) and 1.0 (full credit).",
        },
        "rationale": {
            "type": "string",
            "description": (
                "Why this score. Reference the rubric (accuracy / completeness / understanding). "
                "Be specific about what was correct and what was missing."
            ),
        },
        "evidence": {
            "type": "string",
            "description": (
                "Direct quote or paraphrase from the employee's answer that supports "
                "the score, plus the reference point from the model answer they did or did not address."
            ),
        },
    },
    "required": ["score", "rationale", "evidence"],
}


RECOMMEND_LEARNING_SCHEMA = {
    "type": "object",
    "properties": {
        "weak_topics": {
            "type": "array",
            "description": "1-4 short labels (3-6 words each) naming the areas the employee needs to strengthen.",
            "items": {"type": "string"},
        },
        "next_steps": {
            "type": "array",
            "description": (
                "3-5 ordered, concrete next learning actions the employee can take "
                "this week. Each step must be specific (name the doc, the concept, "
                "the scenario to practice) — not generic advice."
            ),
            "items": {"type": "string"},
        },
        "suggested_resources": {
            "type": "array",
            "description": (
                "1-3 documents or sections from the available knowledge base "
                "the employee should re-read. Reference by document title."
            ),
            "items": {
                "type": "object",
                "properties": {
                    "document_title": {"type": "string"},
                    "focus_area": {
                        "type": "string",
                        "description": "What to look for when re-reading.",
                    },
                },
                "required": ["document_title", "focus_area"],
            },
        },
        "encouragement": {
            "type": "string",
            "description": (
                "One sentence acknowledging what the employee already understands well "
                "(based on the questions they got right), to keep the tone constructive."
            ),
        },
    },
    "required": ["weak_topics", "next_steps", "suggested_resources", "encouragement"],
}


SUMMARIZE_GAPS_SCHEMA = {
    "type": "object",
    "properties": {
        "gaps": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "knowledge_point_id": {"type": "integer"},
                    "summary": {
                        "type": "string",
                        "description": (
                            "1-2 sentence explanation of what the employee misunderstood and why "
                            "it matters for their role."
                        ),
                    },
                },
                "required": ["knowledge_point_id", "summary"],
            },
        }
    },
    "required": ["gaps"],
}
