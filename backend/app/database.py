from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


_db_initialized = False


def get_db():
    global _db_initialized
    if not _db_initialized:
        try:
            Base.metadata.create_all(bind=engine)
            from .seed import seed_if_empty
            seed_if_empty()
            _db_initialized = True
        except Exception:
            pass

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
