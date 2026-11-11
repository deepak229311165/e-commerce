from typing import Dict
from src.mongodb.users import get_db

def _summarize(doc: dict | None) -> dict:
    items = (doc or {}).get("items", [])
    total = round(sum(i["price"] * i["quantity"] for i in items), 2)
    count = sum(i["quantity"] for i in items)
    return  {"items": items, "total": total, "count": count}

async def get_cart(user_id: str) -> dict:
    doc = await get_db().carts.find_one({"user_id": user_id})
    return _summarize(doc)

async def add_item(user_id: str, product: Dict, quantity: int) -> dict:
    cart = get_db().carts
    updated = await cart.update_one(
        {"user_id": user_id, "items.product_id": product["id"]},
        {"$inc": {"items.$.quantity": quantity}},
    )
    if updated.matched_count == 0:
        await cart.update_one(
            {"user_id":user_id},
            {
                "$push": {
                    "items": {
                        "product_id": product["id"],
                        "name": product["name"],
                        "price": product["price"],
                        "image": product["image"],
                        "quantity": quantity,
                    }
                }
            },
            upsert=True,
        )
    return await get_cart(user_id)

async def remove_item(user_id: str, product_id: str) -> dict:
    await get_db().carts.update_one(
        {"user_id": user_id}, {"$pull": {"items": {"product_id": product_id}}}
    )
    return await get_cart(user_id)

async def clear_cart(user_id: str) -> None:
    await get_db().carts.update_one({"user_id": user_id}, {"$set": {"items": []}})