from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.vehicle import Vehicle
from app.schemas.vehicle import VehicleCreate, VehicleRead


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[VehicleRead])
def list_items(db: Session = Depends(get_db)):
    return list(db.scalars(select(Vehicle).order_by(Vehicle.id)).all())


@router.post("", response_model=VehicleRead, status_code=201)
def create_item(payload: VehicleCreate, db: Session = Depends(get_db)):
    item = Vehicle(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(Vehicle, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    db.delete(item)
    db.commit()
