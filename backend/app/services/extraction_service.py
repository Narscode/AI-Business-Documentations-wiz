"""AI extraction: document text -> knowledge points (status=pending)."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from ..ai import prompts, tools
from ..ai.client import call_tool
from ..config import settings
from ..models import Document, KnowledgePoint

logger = logging.getLogger("kvp.extraction")

MAX_DOC_CHARS = 80_000  # ~20K tokens, leaves room for response


def extract_knowledge(db: Session, document: Document) -> list[KnowledgePoint]:
    if not document.content_text or not document.content_text.strip():
        raise ValueError("Document has no parsed text — cannot extract.")

    text = document.content_text
    if len(text) > MAX_DOC_CHARS:
        logger.warning(
            "doc %s text length %d exceeds %d, truncating",
            document.id,
            len(text),
            MAX_DOC_CHARS,
        )
        text = text[:MAX_DOC_CHARS]

    document.status = "extracting"
    db.commit()

    try:
        result = call_tool(
            model=settings.MODEL_HEAVY,
            system=prompts.EXTRACTION_SYSTEM,
            user_content=prompts.extraction_user_message(document.title, text),
            tool_name="extract_knowledge",
            tool_schema=tools.EXTRACT_KNOWLEDGE_SCHEMA,
            max_tokens=6000,
        )
    except Exception as e:  # noqa: BLE001
        document.status = "failed"
        document.error_message = str(e)[:1000]
        db.commit()
        raise

    raw_points = result.get("knowledge_points", [])
    created: list[KnowledgePoint] = []
    for rp in raw_points:
        kp = KnowledgePoint(
            document_id=document.id,
            title=rp["title"][:300],
            description=rp["description"],
            source_excerpt=rp.get("source_excerpt", "")[:2000],
            confidence=float(rp.get("confidence", 0.7)),
            status="pending",
        )
        db.add(kp)
        created.append(kp)

    document.status = "extracted"
    document.error_message = None
    db.commit()
    for kp in created:
        db.refresh(kp)
    return created
