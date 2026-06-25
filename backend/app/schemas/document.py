from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    original_filename: str
    status: str
    created_at: datetime
    kp_count: int = 0
    kp_approved: int = 0


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    original_filename: str
    mime_type: str
    status: str
    error_message: str | None = None
    created_at: datetime
    content_preview: str = ""
