"""Tag CRUD."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import RequireUser
from app.database import get_db
from app.models import Tag
from app.schemas import TagCreate, TagOut, TagUpdate


router = APIRouter(prefix="/api/tags", tags=["tags"], dependencies=[RequireUser])


@router.get("", response_model=list[TagOut])
def list_tags(db: Session = Depends(get_db)):
    return db.query(Tag).order_by(Tag.name).all()


@router.post("", response_model=TagOut, status_code=201)
def create_tag(payload: TagCreate, db: Session = Depends(get_db)):
    name = payload.name.strip().lower()
    existing = db.query(Tag).filter(Tag.name == name).first()
    if existing:
        return existing
    tag = Tag(name=name, color=payload.color)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.patch("/{tag_id}", response_model=TagOut)
def update_tag(tag_id: int, payload: TagUpdate, db: Session = Depends(get_db)):
    tag = db.get(Tag, tag_id)
    if tag is None:
        raise HTTPException(404, "Tag not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        if k == "name" and v:
            v = v.strip().lower()
        setattr(tag, k, v)
    db.commit()
    db.refresh(tag)
    return tag


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = db.get(Tag, tag_id)
    if tag is None:
        raise HTTPException(404, "Tag not found")
    db.delete(tag)
    db.commit()
