from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LoadItemCreate(BaseModel):
    product_id: int
    quantity: int


class LoadItemRead(LoadItemCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)


class LoadCreate(BaseModel):
    reference: str
    vehicle_id: int | None = None
    container_id: int | None = None
    items: list[LoadItemCreate] = []


class LoadRead(BaseModel):
    id: int
    reference: str
    status: str
    vehicle_id: int | None
    container_id: int | None
    created_at: datetime
    items: list[LoadItemRead]

    model_config = ConfigDict(from_attributes=True)
