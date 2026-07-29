from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User


def create_initial_admin(db: Session) -> None:
    user = db.scalar(select(User).where(User.email == "admin@gerbar.local"))
    if user:
        return

    db.add(
        User(
            email="admin@gerbar.local",
            full_name="Administrador GerBar",
            hashed_password=hash_password("Admin123!"),
            role="admin",
        )
    )
    db.commit()
