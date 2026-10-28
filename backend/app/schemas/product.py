from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProductCreate(BaseModel):
    sku: str
    name: str
    length_m: float
    width_m: float
    height_m: float
    weight_kg: float
    max_stack_weight_kg: float | None = None
    stackable: bool = True
    rotatable: bool = True
    fragile: bool = False


class ProductRead(ProductCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
