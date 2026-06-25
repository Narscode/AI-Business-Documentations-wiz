from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User


def get_current_user(
    x_user_id: int | None = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db),
) -> User:
    if x_user_id is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Missing X-User-Id header (use role switcher)"
        )
    user = db.get(User, x_user_id)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown user")
    return user


def require_role(*roles: str):
    def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Role '{user.role}' not permitted; requires one of {list(roles)}",
            )
        return user

    return _checker
