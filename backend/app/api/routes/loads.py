from datetime import datetime
import json

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
    LoadPlanUpdate,
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


def apply_payload(load: Load, payload):
    fields = (
        "reference",
        "client_name",
        "project_name",
        "vessel_name",
        "voyage_number",
        "booking_number",
        "loading_port",
        "destination_port",
        "loading_date",
        "sailing_date",
        "carrier_name",
        "operator_name",
        "notes",
        "vehicle_id",
        "container_id",
    )

    for field in fields:
        setattr(load, field, getattr(payload, field))


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

    load = Load(status="pending")
    apply_payload(load, payload)
    replace_items(load, payload.items, db)

    db.add(load)
    db.commit()
    return get_load(load.id, db)

@router.put("/{load_id}", response_model=LoadRead)
def update_load(
    load_id: int,
    payload: LoadUpdate,
    db: Session = Depends(get_db),
):
    load = get_load(load_id, db)

    duplicate = db.scalar(
        select(Load).where(
            Load.reference == payload.reference,
            Load.id != load_id,
        )
    )

    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="La referencia ya existe",
        )

    # Detectar si cambió la unidad
    unit_changed = (
        load.vehicle_id != payload.vehicle_id
        or load.container_id != payload.container_id
    )

    # Detectar si cambiaron productos o cantidades
    current_items = sorted(
        [
            (item.product_id, item.quantity)
            for item in load.items
        ]
    )

    new_items = sorted(
        [
            (item.product_id, item.quantity)
            for item in payload.items
        ]
    )

    products_changed = current_items != new_items

    optimization_invalidated = (
        unit_changed or products_changed
    )

    # Actualizar datos generales
    apply_payload(load, payload)

    replace_items(
        load,
        payload.items,
        db,
    )

    # Si cambió unidad/productos, el plan ya no es válido
    if optimization_invalidated:
        load.status = "pending"

        load.plan_data = ""
        load.plan_updated_at = None

        load.total_weight_kg = 0
        load.total_volume_m3 = 0

        load.center_of_gravity_x = 0
        load.center_of_gravity_y = 0
        load.center_of_gravity_z = 0

        load.optimized_at = None
        load.report_path = ""

    # Si solo cambian datos logísticos,
    # conservamos estado y plan existentes
    else:
        load.status = load.status or "pending"

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


@router.patch("/{load_id}/plan", response_model=LoadRead)
def save_plan(
    load_id: int,
    payload: LoadPlanUpdate,
    db: Session = Depends(get_db),
):
    load = get_load(load_id, db)

    try:
        parsed = json.loads(payload.plan_data)
    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=422,
            detail="El plan de carga no contiene JSON válido",
        ) from error

    if not isinstance(parsed, dict):
        raise HTTPException(
            status_code=422,
            detail="El plan de carga debe ser un objeto JSON",
        )

    load.plan_data = payload.plan_data
    load.plan_version = payload.plan_version
    load.plan_updated_at = datetime.utcnow()

    db.commit()
    return get_load(load.id, db)

@router.delete("/{load_id}/plan", response_model=LoadRead)
def delete_plan(
    load_id: int,
    db: Session = Depends(get_db),
):
    load = get_load(load_id, db)

    load.plan_data = ""
    load.plan_updated_at = None
    load.status = "pending"

    db.commit()

    return get_load(
        load.id,
        db,
    )

@router.delete("/{load_id}", status_code=204)
def delete_load(load_id: int, db: Session = Depends(get_db)):
    load = get_load(load_id, db)
    db.delete(load)
    db.commit()
