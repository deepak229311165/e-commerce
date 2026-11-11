"""Database functions for the `products` collection.

Every function returns plain dicts with `id` (a string) instead of Mongo's
`_id` (an ObjectId), so the routes can hand them straight to FastAPI.
"""
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument

from src.mongodb.users import get_db


def _oid(value: str) -> Optional[ObjectId]:
    """Turn a string into an ObjectId, or None if it isn't a valid id."""
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        return None


def _out(doc: dict) -> dict:
    out = dict(doc)
    out["id"] = str(out.pop("_id"))
    return out


async def list_products(category: Optional[str] = None, seller_id: Optional[str] = None) -> list:
    query: dict = {}
    if category:
        query["category"] = category
    if seller_id:
        query["seller_id"] = seller_id
    docs = await get_db().products.find(query).sort("created_at", -1).to_list(length=500)
    return [_out(d) for d in docs]


async def get_product(product_id: str) -> Optional[dict]:
    oid = _oid(product_id)
    if oid is None:
        return None
    doc = await get_db().products.find_one({"_id": oid})
    return _out(doc) if doc else None


async def create_product(seller_id: str, data: dict) -> dict:
    doc = {
        **data,
        "seller_id": seller_id,
        "rating": 0.0,
        "created_at": datetime.now(timezone.utc),
    }
    result = await get_db().products.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _out(doc)


async def update_product(product_id: str, seller_id: str, changes: dict) -> Optional[dict]:
    """Update a product, but ONLY if it belongs to this seller.

    The filter has both `_id` and `seller_id`, so a seller who guesses another
    seller's product id simply matches nothing (-> None -> 404).
    """
    oid = _oid(product_id)
    if oid is None:
        return None
    flt = {"_id": oid, "seller_id": seller_id}
    if not changes:
        doc = await get_db().products.find_one(flt)
    else:
        doc = await get_db().products.find_one_and_update(
            flt, {"$set": changes}, return_document=ReturnDocument.AFTER
        )
    return _out(doc) if doc else None


async def delete_product(product_id: str, seller_id: str) -> bool:
    oid = _oid(product_id)
    if oid is None:
        return False
    result = await get_db().products.delete_one({"_id": oid, "seller_id": seller_id})
    return result.deleted_count == 1

async def decrement_stock(product_id: str, quantity: int) -> bool:
    oid = _oid(product_id)
    if oid is None:
        return False
    result = await get_db().products.update_one(
        {"_id": oid, "stock": {"$gte": quantity}}, {"$inc": {"stock": -quantity}}
    )
    return result.modified_count == 1

async def restock(product_id: str, quantity: int) -> None:
    oid = _oid(product_id)
    if oid is None:
        await get_db().products.update_one({"_id": oid}, {"$inc": {"stock": quantity}})