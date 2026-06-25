from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import Document, KnowledgePoint, User
from ..schemas import KnowledgePointCreate, KnowledgePointRead, KnowledgePointUpdate

router = APIRouter(prefix="/api/knowledge-points", tags=["knowledge"])


def _to_read(kp: KnowledgePoint, doc_title: str = "") -> KnowledgePointRead:
    return KnowledgePointRead(
        id=kp.id,
        document_id=kp.document_id,
        title=kp.title,
        description=kp.description,
        source_excerpt=kp.source_excerpt,
        confidence=kp.confidence,
        status=kp.status,
        created_at=kp.created_at,
        updated_at=kp.updated_at,
        document_title=doc_title,
    )


@router.get("", response_model=list[KnowledgePointRead])
def list_kps(
    document_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(KnowledgePoint, Document.title).join(
        Document, Document.id == KnowledgePoint.document_id
    )
    if document_id is not None:
        stmt = stmt.where(KnowledgePoint.document_id == document_id)
    if status_filter:
        stmt = stmt.where(KnowledgePoint.status == status_filter)
    stmt = stmt.order_by(KnowledgePoint.id.desc())
    rows = db.execute(stmt).all()
    return [_to_read(kp, title) for kp, title in rows]


@router.patch("/{kp_id}", response_model=KnowledgePointRead)
def update_kp(
    kp_id: int,
    payload: KnowledgePointUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    kp = db.get(KnowledgePoint, kp_id)
    if not kp:
        raise HTTPException(404, "Knowledge point not found")
    edited = False
    if payload.title is not None:
        kp.title = payload.title[:300]
        edited = True
    if payload.description is not None:
        kp.description = payload.description
        edited = True
    if payload.source_excerpt is not None:
        kp.source_excerpt = payload.source_excerpt[:2000]
        edited = True
    if payload.status is not None:
        kp.status = payload.status
    elif edited:
        kp.status = "edited"
    kp.edited_by_id = user.id if edited else kp.edited_by_id
    db.commit()
    db.refresh(kp)
    doc = db.get(Document, kp.document_id)
    return _to_read(kp, doc.title if doc else "")


@router.post("", response_model=KnowledgePointRead, status_code=status.HTTP_201_CREATED)
def create_kp(
    payload: KnowledgePointCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    doc = db.get(Document, payload.document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    kp = KnowledgePoint(
        document_id=payload.document_id,
        title=payload.title[:300],
        description=payload.description,
        source_excerpt=payload.source_excerpt[:2000],
        confidence=payload.confidence,
        status="approved",
        edited_by_id=user.id,
    )
    db.add(kp)
    db.commit()
    db.refresh(kp)
    return _to_read(kp, doc.title)
