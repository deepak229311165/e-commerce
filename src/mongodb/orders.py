from datetime import timezone, datetime
from pydoc import doc
from typing import Optional

from pymongo import ASCENDING, DESCENDING, ReturnDocument

from src.mongodb.users import get_db

def _out(doc: dict) -> dict:
    out = dict(doc)
    out["_id"] = str(out.pop("_id"))
    return out

async def ensure_indexes() -> None:
    orders = get_db().orders
    await orders.create_index("razorpay_order_id", unique=True)
    await orders.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])

async def create_order(doc: dict) -> dict:
    doc = {**doc, "status":"created", "razorpay_payment_id": None,
           "paid_at": None, "created_at": datetime.now(timezone.utc)}
    await get_db().orders.insert_one(doc)
    return _out(doc)

async def get_by_razorpay_order_id(razorpay_order_id: str, user_id: Optional[str] = None) -> Optional[dict]:
    flt: dict = {"razorpay_order_id": razorpay_order_id}
    if user_id is not None:
        flt["user_id"] = user_id
    doc = await get_db().orders.find_one(flt)
    return _out(doc) if doc else None

async def list_for_user(user_id: str) -> list:
    docs = await get_db().orders.find({"user_id": user_id}).sort("created_at", -1).to_list(length=200)
    return [_out(d) for d in docs]

async def mark_paid(razorpay_order_id: str, razorpay_payment_id: str) -> Optional[dict]:
        doc = await get_db().orders.find_one_and_update(
             {"razorpay_order_id": razorpay_order_id, "status": "created"},
             {"$set": {"status": "paid", "razorpay_payment_id": razorpay_payment_id,
                    "paid_at": datetime.now(timezone.utc)}},
              return_document=ReturnDocument.AFTER,
        )
        return _out(doc) if doc else None

async def mark_status(razorpay_order_id: str, status: str, note: str | None = None) -> None:
        
        await get_db().orders.update_one(
        {"razorpay_order_id": razorpay_order_id},
        {"$set": {"status": status, "note": note}},
        )
