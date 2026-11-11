from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from src.config import settings 

_client: Optional[AsyncIOMotorClient] = None

def get_db() -> AsyncIOMotorDatabase:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.MONGO_URI)
    return _client[settings.MONGO_NAME]

async def ensure_indexes() -> None:
    db = get_db()
    await db.users.create_index("email", unique=True)
    await db.carts.create_index("user_id", unique=True)

def serialize_user(doc: dict) -> dict:
     return {"id": str(doc["_id"]), "name": doc["name"], "email": doc["email"], "role": doc.get("role", "buyer")}

async def create_user(name: str, email: str, password_hash: str, role: str = "buyer") -> dict:
    doc = {
        "name": name,
        "email": email.lower(),
        "role": role,
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc),
    }
    result = await get_db().users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc

async def get_user_by_email(email: str) -> Optional[dict]:
    return await get_db().users.find_one({"email": email.lower()})

async def get_user_by_id(user_id: str) -> Optional[dict]:
    try:
        oid = ObjectId(user_id) 
    except Exception:
        return None
    return await get_db().users.find_one({"_id": oid})