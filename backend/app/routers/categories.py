"""Category CRUD + reorder."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import RequireUser
from app.database import get_db
from app.models import Category
from app.schemas import CategoryCreate, CategoryOut, CategoryUpdate, ReorderRequest


router = APIRouter(prefix="/api/categories", tags=["categories"], dependencies=[RequireUser])


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.sort_order, Category.id).all()


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    last = db.query(Category).order_by(Category.sort_order.desc()).first()
    sort_order = (last.sort_order + 100) if last else 100
    cat = Category(**payload.model_dump(), sort_order=sort_order)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/{cat_id}", response_model=CategoryOut)
def update_category(cat_id: int, payload: CategoryUpdate, db: Session = Depends(get_db)):
    cat = db.get(Category, cat_id)
    if cat is None:
        raise HTTPException(404, "Category not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(cat, k, v)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{cat_id}", status_code=204)
def delete_category(cat_id: int, db: Session = Depends(get_db)):
    cat = db.get(Category, cat_id)
    if cat is None:
        raise HTTPException(404, "Category not found")
    db.delete(cat)
    db.commit()


@router.post("/reorder", status_code=204)
def reorder_categories(payload: ReorderRequest, db: Session = Depends(get_db)):
    by_id = {c.id: c for c in db.query(Category).filter(Category.id.in_([i.id for i in payload.items])).all()}
    for item in payload.items:
        c = by_id.get(item.id)
        if c is not None:
            c.sort_order = item.sort_order
    db.commit()
