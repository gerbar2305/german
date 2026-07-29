from datetime import datetime

from pydantic import BaseModel, ConfigDict


class VehicleCreate(BaseModel):
    name: str
    plate: str
    vehicle_type: str = "truck"
    internal_length_m: float
    internal_width_m: float
    internal_height_m: float
    max_payload_kg: float


class VehicleRead(VehicleCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
