from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ContainerCreate(BaseModel):
    code: str
    container_type: str

    internal_length_m: float
    internal_width_m: float
    internal_height_m: float

    tare_weight_kg: float = 0
    max_gross_weight_kg: float = 0
    max_payload_kg: float


class ContainerRead(ContainerCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)