"""Fill the products collection with the starter catalogue.
 
Run from the project root:
    python scripts/seed_products.py
 
Safe to run again: it replaces only the seeded products (seller_id = None),
never products that real sellers created.
"""

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.mongodb.users import ensure_indexes, get_db


IMG = "https://images.unsplash.com/{}?auto=format&fit=crop&w=600&q=70"
 
SEED = [
    ("Aero Wireless Headphones", "Electronics", 129.0, 169.0, 4.7, "photo-1505740420928-5e560c06d30e", "Best seller", 40),
    ("Pulse Smartwatch S2", "Electronics", 199.0, None, 4.5, "photo-1523275335684-37898b6baf30", "New", 25),
    ("Linen Overshirt", "Fashion", 59.0, 79.0, 4.4, "photo-1596755094514-f87e34085b2c", "-25%", 60),
    ("Trail Runner Sneakers", "Fashion", 89.0, None, 4.6, "photo-1542291026-7eec264c27ff", None, 35),
    ("Ceramic Pour-Over Set", "Home", 44.0, 54.0, 4.8, "photo-1495474472287-4d71bcdd2085", "Top rated", 80),
    ("Oak Desk Lamp", "Home", 72.0, None, 4.3, "photo-1507473885765-e6ed057f782c", None, 18),
    ("Everyday Leather Backpack", "Fashion", 149.0, 189.0, 4.7, "photo-1553062407-98eeb64c6a62", "-21%", 22),
    ("Mechanical Keyboard K75", "Electronics", 109.0, None, 4.6, "photo-1587829741301-dc798b83add3", "New", 30),
]

async def main() -> None:
    await ensure_indexes()
    products = get_db().products
    removed = await products.delete_many({"seller_id": None})
    now = datetime.now(timezone.utc)
    docs = [
        {
            "name": name,
            "category": category,
            "price": price,
            "old_price": old_price,
            "rating": rating,
            "image": IMG.format(photo),
            "badge": badge,
            "stock": stock,
            "description": "",
            "seller_id": None,
            # first item is the newest, so the shop keeps this order
            "created_at": now - timedelta(seconds=i),
        }
        for i, (name, category, price, old_price, rating, photo, badge, stock) in enumerate(SEED)
    ]
    await products.insert_many(docs)
    print(f"replaced {removed.deleted_count} seeded products with {len(docs)} new ones" )

if __name__ == "__main__":
    asyncio.run(main())