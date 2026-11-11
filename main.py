from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, APIRouter, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.login import router as auth_router
from src.login import get_current_user
from src.config import Settings
from src.mongodb import users as users_db
from src.mongodb import cart as cart_db
from src.schema import Product, CartAdd, CartOut, DashboardStats, UserOut
from src.mongodb import products as products_db
from src.mongodb import orders as orders_db
from src.payments import router as payments_router
from src.payments import orders_router, serialize_order
from src.products import public_router as products_router
from src.products import seller_router


settings = Settings()

@asynccontextmanager
async def lifespan(_:FastAPI):
    await users_db.ensure_indexes()
    await orders_db.ensure_indexes()
    yield   


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,   
    allow_methods=["*"],
    allow_headers=["*"],    
)
app.include_router(auth_router)
app.include_router(products_router)
app.include_router(seller_router)
app.include_router(payments_router)
app.include_router(orders_router)

@app.get("/health")
async def health():
        return {"status": "ok", "app": settings.APP_NAME}

cart_router = APIRouter(prefix="/cart", tags=["cart"])

@cart_router.get("", response_model=CartOut)
async def get_cart(user: dict = Depends(get_current_user)):
      return await cart_db.get_cart(str(user["_id"]))

@cart_router.post("", response_model=CartOut)
async def add_to_cart(body: CartAdd, user:dict = Depends(get_current_user)):
      product = await products_db.get_product(body.product_id)
      if not product:
            raise HTTPException(404, "product not found")

      stock = product.get("stock", 0)
      if stock < 1:     
            raise HTTPException(400, "out of stock")
      product_id_str = str(product.get("_id") or product.get("id"))
      
      cart = await cart_db.get_cart(str(user["_id"]))
      in_cart = next(
            (i["quantity"] for i in cart["items"] if i["product_id"] == product_id_str), 0
      )
      if in_cart + body.quantity > stock:
            raise HTTPException(400, f"only {stock} in stock, ({in_cart} already in cart)")

      return await cart_db.add_item(str(user["_id"]), product, body.quantity)

@cart_router.delete("/{product_id}", response_model=CartOut)
async def remove_from_cart(product_id: str, user: dict = Depends(get_current_user)):
      return await cart_db.remove_item(str(user["_id"]), product_id)

app.include_router(cart_router)

@app.get("/dashboard", response_model=DashboardStats)
async def dashboard(user: dict = Depends(get_current_user)):
      user_id = str(user["_id"])
      cart = await cart_db.get_cart(user_id)

      raw_orders = await orders_db.list_for_user(user_id)
      orders = [serialize_order(o) for o in raw_orders]

      paid_orders = [o for o in orders if o["status"] == "paid"]
      total_spent = sum(o["amount"] for o in paid_orders) / 100.0

      recent_orders = [
            {
            "id": f"#SS-{o['id'][-6:]}",
            "date": o["created_at"].strftime("%d %b %Y"),
            "status": o["status"].replace("_", " ").title(),
            "total": o["amount"] / 100.0
            }
            for o in orders[:4]
      ] 

      return DashboardStats(
            user=UserOut(**users_db.serialize_user(user)),
            cart_count=cart["count"],
            cart_total=cart["total"],
            orders_placed=len(paid_orders),
            total_spent=total_spent,
            wishlist=7,
            recent_orders=recent_orders,
            sales_last_7_days=[120,180,90,240,210,300,260],
      )

if __name__ == "__main__":
      import uvicorn

      uvicorn.run("main:app", host=settings.APP_HOST, port=settings.APP_PORT, reload=True)    