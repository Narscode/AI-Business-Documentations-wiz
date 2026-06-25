from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import Document, KnowledgePoint, User
from ..schemas import DocumentRead, DocumentSummary
from ..services import document_parser, extraction_service

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _to_summary(db: Session, doc: Document) -> DocumentSummary:
    total = (
        db.scalar(
            select(func.count(KnowledgePoint.id)).where(KnowledgePoint.document_id == doc.id)
        )
        or 0
    )
    approved = (
        db.scalar(
            select(func.count(KnowledgePoint.id)).where(
                KnowledgePoint.document_id == doc.id,
                KnowledgePoint.status.in_(("approved", "edited")),
            )
        )
        or 0
    )
    return DocumentSummary(
        id=doc.id,
        title=doc.title,
        original_filename=doc.original_filename,
        status=doc.status,
        created_at=doc.created_at,
        kp_count=total,
        kp_approved=approved,
    )


@router.get("", response_model=list[DocumentSummary])
def list_documents(
    db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    docs = (
        db.execute(select(Document).order_by(Document.created_at.desc())).scalars().all()
    )
    return [_to_summary(db, d) for d in docs]


@router.get("/{doc_id}", response_model=DocumentRead)
def get_document(
    doc_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    return DocumentRead(
        id=doc.id,
        title=doc.title,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        status=doc.status,
        error_message=doc.error_message,
        created_at=doc.created_at,
        content_preview=(doc.content_text or "")[:2000],
    )


@router.post("", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    data = file.file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    try:
        text = document_parser.parse(
            file.filename or "upload", file.content_type or "", data
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Failed to parse: {e}")

    doc = Document(
        title=(file.filename or "Untitled").rsplit(".", 1)[0][:300],
        original_filename=file.filename or "upload",
        mime_type=file.content_type or "application/octet-stream",
        content_text=text,
        status="uploaded",
        uploaded_by_id=user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return DocumentRead(
        id=doc.id,
        title=doc.title,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        status=doc.status,
        error_message=doc.error_message,
        created_at=doc.created_at,
        content_preview=text[:2000],
    )


@router.post("/{doc_id}/extract", response_model=DocumentRead)
def extract(
    doc_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    try:
        extraction_service.extract_knowledge(db, doc)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Extraction failed: {e}")
    db.refresh(doc)
    return DocumentRead(
        id=doc.id,
        title=doc.title,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        status=doc.status,
        error_message=doc.error_message,
        created_at=doc.created_at,
        content_preview=(doc.content_text or "")[:2000],
    )
