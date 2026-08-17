from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductRead


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[ProductRead])
def list_items(db: Session = Depends(get_db)):
    return list(
        db.scalars(
            select(Product).order_by(Product.id)
        ).all()
    )


@router.post("", response_model=ProductRead, status_code=201)
def create_item(
    payload: ProductCreate,
    db: Session = Depends(get_db),
):
    item = Product(**payload.model_dump())

    db.add(item)
    db.commit()
    db.refresh(item)

    return item


@router.put("/{item_id}", response_model=ProductRead)
def update_item(
    item_id: int,
    payload: ProductCreate,
    db: Session = Depends(get_db),
):
    item = db.get(Product, item_id)

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Producto no encontrado",
        )

    values = payload.model_dump()

    for field, value in values.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)

    return item


@router.patch("/{item_id}", response_model=ProductRead)
def patch_item(
    item_id: int,
    payload: ProductCreate,
    db: Session = Depends(get_db),
):
    item = db.get(Product, item_id)

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Producto no encontrado",
        )

    values = payload.model_dump()

    for field, value in values.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)

    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
):
    item = db.get(Product, item_id)

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Producto no encontrado",
        )

    db.delete(item)
    db.commit()