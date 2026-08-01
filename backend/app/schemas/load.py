from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator

class LoadItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)

class LoadItemRead(LoadItemCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)

class LoadCreate(BaseModel):
    reference: str
    client_name: str = ""
    project_name: str = ""
    notes: str = ""
    vehicle_id: int | None = None
    container_id: int | None = None
    items: list[LoadItemCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_load(self):
        if bool(self.vehicle_id) == bool(self.container_id):
            raise ValueError("Selecciona un vehículo o un contenedor.")
        if not self.items:
            raise ValueError("Agrega al menos un producto.")
        return self

class LoadUpdate(LoadCreate):
    status: str = "pending"

class LoadOptimizationUpdate(BaseModel):
    status: str
    total_weight_kg: float = Field(ge=0)
    total_volume_m3: float = Field(ge=0)
    center_of_gravity_x: float | None = None
    center_of_gravity_y: float | None = None
    center_of_gravity_z: float | None = None
    optimized_at: datetime | None = None
    report_path: str = ""

class LoadRead(BaseModel):
    id: int
    reference: str
    client_name: str
    project_name: str
    notes: str
    status: str
    vehicle_id: int | None
    container_id: int | None
    total_weight_kg: float
    total_volume_m3: float
    center_of_gravity_x: float | None
    center_of_gravity_y: float | None
    center_of_gravity_z: float | None
    optimized_at: datetime | None
    report_path: str
    created_at: datetime
    updated_at: datetime
    items: list[LoadItemRead]
    model_config = ConfigDict(from_attributes=True)
