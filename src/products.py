"""
product routes.
public_router -> /products     anyone can browse
seller_router -> /seller/products     only logged in sellers
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Response, Depends

from src.login import get_current_seller
from src.mongodb import products as db
from src.schema import Product, ProductCreate, ProductUpdate

PLACEHOLDER_IMAGE = "https://placehold.co/600x600?text=No+image"

public_router = APIRouter(prefix="/products", tags=["products"])
seller_router = APIRouter(prefix="/seller/products", tags=["seller"])

@public_router.get("", response_model=List[Product])
async def list_products(category: Optional[str] = None):
    return await db.list_products(category=category)

@public_router.get("/{product_id}", response_model=Product)
async def get_product(product_id: str):
    product = await db.get_product(product_id)
    if not product:
        raise HTTPException(404, "product not found")
    return product

@seller_router.get("", response_model=List[Product])
async def my_products(seller: dict = Depends(get_current_seller)):
    """READ: only this sellers own listings"""
    return await db.list_products(seller_id=str(seller["_id"]))

@seller_router.post("", response_model=Product, status_code=201)
async def add_product(body: ProductCreate, seller: dict = Depends(get_current_seller)):
    """CREATE"""
    data = body.model_dump()    
    data["image"] = data["image"] or PLACEHOLDER_IMAGE
    return await db.create_product(str(seller["_id"]), data)

@seller_router.patch("/{product_id}", response_model=Product)
async def edit_product(product_id: str, body: ProductUpdate, seller: dict = Depends(get_current_seller)):
    """UPDATE: only the fields seller wants"""
    changes = body.model_dump(exclude_unset=True)
    changes = {k: v for k, v in changes.items() if v is not None or k in ("old_price", "badge")}
    if not changes.get("image", "x"):
        changes.pop("image")
    product = await db.update_product(product_id, str(seller["_id"]), changes)
    if not product:
        raise HTTPException(404, "product not found")
    return product

@seller_router.delete("/{product_id}", status_code=204)
async def remove_product(product_id: str, seller: dict = Depends(get_current_seller)):
    """DELETE"""
    if not await db.delete_product(product_id, str(seller["_id"])):
        raise HTTPException(404, "product not found")
    return Response(status_code=204)