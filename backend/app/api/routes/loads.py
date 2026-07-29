from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.load import Load, LoadItem
from app.models.product import Product
from app.schemas.load import LoadCreate, LoadRead


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[LoadRead])
def list_loads(db: Session = Depends(get_db)):
    statement = select(Load).options(selectinload(Load.items)).order_by(Load.id)
    return list(db.scalars(statement).all())


@router.post("", response_model=LoadRead, status_code=201)
def create_load(payload: LoadCreate, db: Session = Depends(get_db)):
    if db.scalar(select(Load).where(Load.reference == payload.reference)):
        raise HTTPException(status_code=409, detail="La referencia ya existe")

    load = Load(
        reference=payload.reference,
        vehicle_id=payload.vehicle_id,
        container_id=payload.container_id,
    )

    for item in payload.items:
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

    db.add(load)
    db.commit()

    statement = (
        select(Load)
        .where(Load.id == load.id)
        .options(selectinload(Load.items))
    )
    return db.scalar(statement)
