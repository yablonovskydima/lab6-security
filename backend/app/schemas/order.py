from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models import OrderStatus
from app.schemas.common import ORM


class OrderItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, le=1000)


class OrderIn(BaseModel):
    items: list[OrderItemIn] = Field(min_length=1)


class OrderItemOut(ORM):
    product_id: int
    quantity: int
    price: Decimal


class OrderOut(ORM):
    id: int
    user_id: int
    status: OrderStatus
    created_at: datetime
    items: list[OrderItemOut]
    total: Decimal


class OrderStatusIn(BaseModel):
    status: OrderStatus
