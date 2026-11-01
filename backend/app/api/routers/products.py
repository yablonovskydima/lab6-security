from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import AdminUser, AnyUser, DbSession
from app.models import Product
from app.schemas.product import ProductIn, ProductOut, ProductUpdateIn

router = APIRouter(prefix="/products", tags=["products"])


def _get_or_404(db: DbSession, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return product


@router.get("", response_model=list[ProductOut])
def list_products(_: AnyUser, db: DbSession):
    return db.scalars(select(Product).order_by(Product.id)).all()


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, _: AnyUser, db: DbSession):
    return _get_or_404(db, product_id)


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(data: ProductIn, _: AdminUser, db: DbSession):
    product = Product(**data.model_dump())
    db.add(product)
    db.commit()
    return product


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, data: ProductUpdateIn, _: AdminUser, db: DbSession):
    product = _get_or_404(db, product_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, _: AdminUser, db: DbSession):
    db.delete(_get_or_404(db, product_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Product is used in orders")
