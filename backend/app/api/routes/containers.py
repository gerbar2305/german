from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.container import Container
from app.schemas.container import ContainerCreate, ContainerRead


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[ContainerRead])
def list_items(db: Session = Depends(get_db)):
    return list(db.scalars(select(Container).order_by(Container.id)).all())


@router.post("", response_model=ContainerRead, status_code=201)
def create_item(payload: ContainerCreate, db: Session = Depends(get_db)):
    item = Container(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(Container, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Contenedor no encontrado")
    db.delete(item)
    db.commit()
@router.put("/{item_id}", response_model=ContainerRead)
def update_item(
    item_id: int,
    payload: ContainerCreate,
    db: Session = Depends(get_db),
):
    item = db.get(Container, item_id)

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Contenedor no encontrado",
        )

    for field, value in payload.model_dump().items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)

    return item