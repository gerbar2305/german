from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Load(Base):
    __tablename__ = "loads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reference: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(40), default="draft")
    vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id"))
    container_id: Mapped[int | None] = mapped_column(ForeignKey("containers.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    items: Mapped[list["LoadItem"]] = relationship(
        back_populates="load",
        cascade="all, delete-orphan",
    )


class LoadItem(Base):
    __tablename__ = "load_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    load_id: Mapped[int] = mapped_column(ForeignKey("loads.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer)

    load: Mapped[Load] = relationship(back_populates="items")
