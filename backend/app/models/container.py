from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Container(Base):
    __tablename__ = "containers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    container_type: Mapped[str] = mapped_column(String(50))
    internal_length_m: Mapped[float] = mapped_column(Float)
    internal_width_m: Mapped[float] = mapped_column(Float)
    internal_height_m: Mapped[float] = mapped_column(Float)
    max_payload_kg: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
