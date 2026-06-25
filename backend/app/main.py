from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .routers import (
    assessments,
    attempts,
    dashboard,
    documents,
    knowledge,
    questions,
    users,
)
import os
from .seed import seed_if_empty

root_path = os.getenv("ROOT_PATH", "")
app = FastAPI(title="Knowledge Verification Platform", version="0.1.0", root_path=root_path)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    
    # Fail-safe: Dynamically check and add new columns to assessments table if missing
    from sqlalchemy import text
    with engine.begin() as conn:
        try:
            # Check if assessments table has the exam_mode column
            res = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='assessments' AND column_name='exam_mode'"
            ))
            if not res.fetchone():
                conn.execute(text("ALTER TABLE assessments ADD COLUMN exam_mode VARCHAR(20) DEFAULT 'practice'"))
                conn.execute(text("ALTER TABLE assessments ADD COLUMN deadline_at TIMESTAMP NULL"))
                conn.execute(text("ALTER TABLE assessments ADD COLUMN attempt_limit INTEGER NULL"))
                conn.execute(text("ALTER TABLE assessments ADD COLUMN show_answers BOOLEAN DEFAULT TRUE"))
                conn.execute(text("ALTER TABLE assessments ADD COLUMN show_explanations BOOLEAN DEFAULT TRUE"))
        except Exception:
            # Fallback for SQLite or connection differences
            try:
                conn.execute(text("ALTER TABLE assessments ADD COLUMN exam_mode VARCHAR(20) DEFAULT 'practice'"))
                conn.execute(text("ALTER TABLE assessments ADD COLUMN deadline_at TIMESTAMP NULL"))
                conn.execute(text("ALTER TABLE assessments ADD COLUMN attempt_limit INTEGER NULL"))
                conn.execute(text("ALTER TABLE assessments ADD COLUMN show_answers BOOLEAN DEFAULT TRUE"))
                conn.execute(text("ALTER TABLE assessments ADD COLUMN show_explanations BOOLEAN DEFAULT TRUE"))
            except Exception:
                pass

    seed_if_empty()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


app.include_router(users.router)
app.include_router(dashboard.router)
app.include_router(documents.router)
app.include_router(knowledge.router)
app.include_router(assessments.router)
app.include_router(questions.router)
app.include_router(attempts.router)
