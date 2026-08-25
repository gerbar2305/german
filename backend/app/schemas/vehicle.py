from datetime import datetime

from pydantic import BaseModel, ConfigDict


class VehicleCreate(BaseModel):
    name: str
    plate: str
    vehicle_type: str = "truck"

    internal_length_m: float
    internal_width_m: float
    internal_height_m: float

    tare_weight_kg: float = 0
    max_gross_weight_kg: float = 0
    max_payload_kg: float

    # Configuración opcional de ejes
    front_axle_position_m: float | None = None
    rear_axle_position_m: float | None = None

    front_axle_max_kg: float | None = None
    rear_axle_max_kg: float | None = None


class VehicleRead(VehicleCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )