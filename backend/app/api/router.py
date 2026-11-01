from fastapi import APIRouter

from app.api.routers import admin, auth, oauth, orders, products, users

api_router = APIRouter()

for r in (auth.router, oauth.router, users.router, products.router, orders.router, admin.router):
    api_router.include_router(r)
