from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import AdminUser, AnyUser, DbSession
from app.models import Order, OrderItem, OrderStatus, Product, Role
from app.schemas.order import OrderIn, OrderOut, OrderStatusIn

router = APIRouter(prefix="/orders", tags=["orders"])


def _get_or_404(db: DbSession, order_id: int) -> Order:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(data: OrderIn, user: AnyUser, db: DbSession):
    order = Order(user_id=user.id)
    for item in data.items:
        product = db.get(Product, item.product_id, with_for_update=True)
        if product is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Product {item.product_id} not found")
        if product.stock < item.quantity:
            raise HTTPException(status.HTTP_409_CONFLICT, f"Not enough stock for '{product.name}'")
        product.stock -= item.quantity
        order.items.append(OrderItem(product_id=product.id, quantity=item.quantity, price=product.price))
    db.add(order)
    db.commit()
    return order


@router.get("/my", response_model=list[OrderOut])
def my_orders(user: AnyUser, db: DbSession):
    return db.scalars(select(Order).where(Order.user_id == user.id).order_by(Order.id.desc())).all()


@router.get("", response_model=list[OrderOut])
def all_orders(_: AdminUser, db: DbSession):
    return db.scalars(select(Order).order_by(Order.id.desc())).all()


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, user: AnyUser, db: DbSession):
    order = _get_or_404(db, order_id)
    if user.role != Role.admin and order.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order


@router.post("/{order_id}/cancel", response_model=OrderOut)
def cancel_order(order_id: int, user: AnyUser, db: DbSession):
    order = _get_or_404(db, order_id)
    if user.role != Role.admin and order.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if order.status != OrderStatus.pending:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only pending orders can be cancelled")
    _restock(db, order)
    order.status = OrderStatus.cancelled
    db.commit()
    return order


@router.patch("/{order_id}/status", response_model=OrderOut)
def set_order_status(order_id: int, data: OrderStatusIn, _: AdminUser, db: DbSession):
    order = _get_or_404(db, order_id)
    if order.status == OrderStatus.cancelled:
        raise HTTPException(status.HTTP_409_CONFLICT, "Order is already cancelled")
    if data.status == OrderStatus.cancelled:
        _restock(db, order)
    order.status = data.status
    db.commit()
    return order


def _restock(db: DbSession, order: Order) -> None:
    for item in order.items:
        product = db.get(Product, item.product_id, with_for_update=True)
        if product is not None:
            product.stock += item.quantity
