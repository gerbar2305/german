from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.load import Load, LoadItem
from app.models.product import Product
from app.schemas.load import (
    LoadCreate,
    LoadOptimizationUpdate,
    LoadRead,
    LoadUpdate,
)

router = APIRouter(dependencies=[Depends(get_current_user)])

def statement():
    return select(Load).options(selectinload(Load.items))

def get_load(load_id: int, db: Session):
    item = db.scalar(statement().where(Load.id == load_id))
    if not item:
        raise HTTPException(status_code=404, detail="Carga no encontrada")
    return item

def replace_items(load, items, db):
    load.items.clear()
    for item in items:
        if not db.get(Product, item.product_id):
            raise HTTPException(
                status_code=404,
                detail=f"Producto {item.product_id} no encontrado",
            )
        load.items.append(
            LoadItem(
                product_id=item.product_id,
                quantity=item.quantity,
            )
        )

@router.get("", response_model=list[LoadRead])
def list_loads(db: Session = Depends(get_db)):
    return list(
        db.scalars(
            statement().order_by(Load.id.desc())
        ).unique().all()
    )

@router.get("/{load_id}", response_model=LoadRead)
def read_load(load_id: int, db: Session = Depends(get_db)):
    return get_load(load_id, db)

@router.post("", response_model=LoadRead, status_code=201)
def create_load(payload: LoadCreate, db: Session = Depends(get_db)):
    if db.scalar(select(Load).where(Load.reference == payload.reference)):
        raise HTTPException(status_code=409, detail="La referencia ya existe")
    load = Load(
        reference=payload.reference,
        client_name=payload.client_name,
        project_name=payload.project_name,
        notes=payload.notes,
        status="pending",
        vehicle_id=payload.vehicle_id,
        container_id=payload.container_id,
    )
    replace_items(load, payload.items, db)
    db.add(load)
    db.commit()
    return get_load(load.id, db)

@router.put("/{load_id}", response_model=LoadRead)
def update_load(load_id: int, payload: LoadUpdate, db: Session = Depends(get_db)):
    load = get_load(load_id, db)
    load.reference = payload.reference
    load.client_name = payload.client_name
    load.project_name = payload.project_name
    load.notes = payload.notes
    load.status = payload.status
    load.vehicle_id = payload.vehicle_id
    load.container_id = payload.container_id
    replace_items(load, payload.items, db)
    db.commit()
    return get_load(load.id, db)

@router.patch("/{load_id}/optimization", response_model=LoadRead)
def update_optimization(
    load_id: int,
    payload: LoadOptimizationUpdate,
    db: Session = Depends(get_db),
):
    load = get_load(load_id, db)
    load.status = payload.status
    load.total_weight_kg = payload.total_weight_kg
    load.total_volume_m3 = payload.total_volume_m3
    load.center_of_gravity_x = payload.center_of_gravity_x
    load.center_of_gravity_y = payload.center_of_gravity_y
    load.center_of_gravity_z = payload.center_of_gravity_z
    load.optimized_at = payload.optimized_at or datetime.utcnow()
    load.report_path = payload.report_path
    db.commit()
    return get_load(load.id, db)

@router.delete("/{load_id}", status_code=204)
def delete_load(load_id: int, db: Session = Depends(get_db)):
    load = get_load(load_id, db)
    db.delete(load)
    db.commit()
