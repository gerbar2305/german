from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    name: Mapped[str] = mapped_column(String(120))
    plate: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        index=True,
    )

    vehicle_type: Mapped[str] = mapped_column(
        String(50),
        default="truck",
    )

    # Dimensiones internas
    internal_length_m: Mapped[float] = mapped_column(Float)
    internal_width_m: Mapped[float] = mapped_column(Float)
    internal_height_m: Mapped[float] = mapped_column(Float)

    # Pesos generales
    tare_weight_kg: Mapped[float] = mapped_column(
        Float,
        default=0,
    )

    max_gross_weight_kg: Mapped[float] = mapped_column(
        Float,
        default=0,
    )

    max_payload_kg: Mapped[float] = mapped_column(Float)

    # -----------------------------------------------------
    # CONFIGURACIÓN DE EJES
    # Todos opcionales.
    #
    # Las posiciones se miden desde el frente del espacio
    # de carga en metros.
    # -----------------------------------------------------

    front_axle_position_m: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        default=None,
    )

    rear_axle_position_m: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        default=None,
    )

    front_axle_max_kg: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        default=None,
    )

    rear_axle_max_kg: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        default=None,
    )

    front_axle_tare_kg: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        default=None,
    )

    rear_axle_tare_kg: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        default=None,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )