from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Load(Base):
    __tablename__ = "loads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reference: Mapped[str] = mapped_column(String(80), unique=True, index=True)

    client_name: Mapped[str] = mapped_column(String(120), default="", server_default="")
    project_name: Mapped[str] = mapped_column(String(160), default="", server_default="")
    vessel_name: Mapped[str] = mapped_column(String(120), default="", server_default="")
    voyage_number: Mapped[str] = mapped_column(String(80), default="", server_default="")
    booking_number: Mapped[str] = mapped_column(String(100), default="", server_default="")
    loading_port: Mapped[str] = mapped_column(String(120), default="", server_default="")
    destination_port: Mapped[str] = mapped_column(String(120), default="", server_default="")
    loading_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    sailing_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    carrier_name: Mapped[str] = mapped_column(String(120), default="", server_default="")
    operator_name: Mapped[str] = mapped_column(String(120), default="", server_default="")
    notes: Mapped[str] = mapped_column(Text, default="", server_default="")

    status: Mapped[str] = mapped_column(
        String(40),
        default="pending",
        server_default="pending",
    )

    vehicle_id: Mapped[int | None] = mapped_column(
        ForeignKey("vehicles.id"),
        nullable=True,
    )
    container_id: Mapped[int | None] = mapped_column(
        ForeignKey("containers.id"),
        nullable=True,
    )

    total_weight_kg: Mapped[float] = mapped_column(Float, default=0, server_default="0")
    total_volume_m3: Mapped[float] = mapped_column(Float, default=0, server_default="0")
    center_of_gravity_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    center_of_gravity_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    center_of_gravity_z: Mapped[float | None] = mapped_column(Float, nullable=True)
    optimized_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    report_path: Mapped[str] = mapped_column(String(500), default="", server_default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    items: Mapped[list["LoadItem"]] = relationship(
        back_populates="load",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class LoadItem(Base):
    __tablename__ = "load_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    load_id: Mapped[int] = mapped_column(ForeignKey("loads.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer)

    load: Mapped[Load] = relationship(back_populates="items")
