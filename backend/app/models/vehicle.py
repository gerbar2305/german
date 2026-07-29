from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    plate: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    vehicle_type: Mapped[str] = mapped_column(String(50), default="truck")
    internal_length_m: Mapped[float] = mapped_column(Float)
    internal_width_m: Mapped[float] = mapped_column(Float)
    internal_height_m: Mapped[float] = mapped_column(Float)
    max_payload_kg: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
