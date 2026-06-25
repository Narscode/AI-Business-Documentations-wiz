from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class KnowledgePointCreate(BaseModel):
    document_id: int
    title: str
    description: str
    source_excerpt: str = ""
    confidence: float = 1.0


class KnowledgePointUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    source_excerpt: str | None = None
    status: Literal["pending", "approved", "rejected", "edited"] | None = None


class KnowledgePointRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    title: str
    description: str
    source_excerpt: str
    confidence: float
    status: str
    created_at: datetime
    updated_at: datetime
    document_title: str = ""
