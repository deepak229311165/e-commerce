import hashlib
import hmac
import logging
from decimal import ROUND_HALF_UP, Decimal
from typing import List
import json
import httpx
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request

from src.config import settings
from src.login import get_current_user
from src.mongodb import cart as cart_db
from src.mongodb import orders as orders_db
from src.mongodb import products as products_db
from src.schema import CreateOrderIn, CreateOrderOut, OrderOut, VerifyPaymentIn

log = logging.getLogger("payments")

router = APIRouter(prefix="/payments", tags=["payments"])
orders_router = APIRouter(prefix="/orders", tags=["orders"])

RAZORPAY_API = "https://api.razorpay.com/v1"
MIN_AMOUNT = 100  # in paise (Rs 1)

# Set to False (or delete the DEBUG lines) once everything works.
DEBUG_PAYMENTS = True


# ---------------------------------------------------------------- helpers

def dbg(msg: str, *args) -> None:
    if DEBUG_PAYMENTS:
        log.warning("DEBUG " + msg, *args)


def mask(value: str) -> str:
    """Show only the first 4 and last 2 characters of a secret."""
    if not value:
        return "<empty>"
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:4]}...{value[-2:]}"


def to_paise(price: float) -> int:
    """Convert rupees to integer paise without float errors."""
    return int(
        (Decimal(str(price)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    )


def make_signature(razorpay_order_id: str, razorpay_payment_id: str, secret: str) -> str:
    # Razorpay format is "order_id|payment_id" -- NO spaces around the pipe.
    message = f"{razorpay_order_id}|{razorpay_payment_id}".encode()
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def signatures_match(expected: str, received: str) -> bool:
    # Constant-time comparison to prevent timing attacks.
    return hmac.compare_digest(expected.encode(), received.encode())


def require_test_keys() -> tuple[str, str]:
    key_id, key_secret = settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET
    if not key_id or not key_secret:
        raise HTTPException(503, "payments are not configured")
    if not key_id.startswith("rzp_test_"):
        raise HTTPException(503, "only razorpay test keys (rzp_test_...) are allowed")
    return key_id, key_secret


def order_ref(order: dict) -> str:
    """Return the order id whether the DB layer uses 'id' or '_id'."""
    return str(order.get("id") or order.get("_id"))


def serialize_order(order: dict | None) -> dict | None:
    """OrderOut needs a string 'id', but MongoDB returns '_id' (ObjectId)."""
    if order is None:
        return None
    out = dict(order)
    if "id" not in out and "_id" in out:
        out["id"] = str(out["_id"])
    out.pop("_id", None)
    return out


async def price_cart(cart_items: list) -> tuple[list, int]:
    """Re-price the cart from the database. Never trust client prices."""
    lines, total = [], 0
    for item in cart_items:
        product = await products_db.get_product(item["product_id"])
        if product is None:
            raise HTTPException(409, f"'{item['name']}' is no longer available")
        if product.get("stock", 0) < item["quantity"]:
            raise HTTPException(409, f"not enough stock for '{product['name']}'")
        total += to_paise(product["price"]) * item["quantity"]
        lines.append(
            {
                "product_id": item["product_id"],
                "name": product["name"],
                "price": product["price"],
                "image": product["image"],
                "quantity": item["quantity"],
                "seller_id": product["seller_id"],
            }
        )
    dbg("price_cart: %d line(s), total=%d paise", len(lines), total)
    return lines, total


async def create_razorpay_order(
    amount: int, receipt: str, notes: dict, key_id: str, key_secret: str
) -> dict:
    payload = {
        "amount": amount,
        "currency": settings.PAYMENT_CURRENCY,
        "receipt": receipt,
        "notes": notes,
    }
    dbg("razorpay create-order payload=%s", payload)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{RAZORPAY_API}/orders", json=payload, auth=(key_id, key_secret)
            )
    except httpx.HTTPError as exc:
        log.error("razorpay unreachable: %s", exc)
        raise HTTPException(502, "payment provider unreachable, try again")
    dbg("razorpay create-order response status=%s", resp.status_code)
    if resp.status_code != 200:
        log.error("razorpay rejected order: %s %s", resp.status_code, resp.text)
        raise HTTPException(502, "payment provider rejected the order")
    return resp.json()


async def fulfil(order: dict, razorpay_payment_id: str) -> dict:
    """Mark paid, reduce stock, clear cart. Safe to call more than once."""
    dbg("fulfil: calling mark_paid for %s", order["razorpay_order_id"])
    paid = await orders_db.mark_paid(order["razorpay_order_id"], razorpay_payment_id)
    if paid is None:
        # Already paid earlier (retry / double click) -> return existing order.
        dbg("fulfil: order was already paid, returning existing order")
        return serialize_order(
            await orders_db.get_by_razorpay_order_id(order["razorpay_order_id"])
        )

    for line in paid["items"]:
        ok = await products_db.decrement_stock(line["product_id"], line["quantity"])
        dbg("fulfil: decrement_stock product=%s qty=%s ok=%s",
            line["product_id"], line["quantity"], ok)
        if not ok:
            log.warning(
                "order %s paid but stock short for %s", order_ref(paid), line["product_id"]
            )

    await cart_db.clear_cart(paid["user_id"])
    dbg("fulfil: cart cleared for user %s", paid["user_id"])
    return serialize_order(paid)

async def refund_payment(payment_id: str, amount: int) -> bool:
    key_id, key_secret = require_test_keys()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{RAZORPAY_API}/payments/{payment_id}/refund",
                json={"amount": amount},
                auth=(key_id, key_secret),
            )
        return r.status_code == 200
    except httpx.HTTPError:
        return False

async def fulfil(order: dict, razorpay_payment_id: str) -> dict:
    rzp_id = order["razorpay_order_id"]
    paid = await orders_db.mark_paid(rzp_id, razorpay_payment_id)
    if paid is None:
        return serialize_order(
            await orders_db.get_by_razorpay_order_id(rzp_id)
        ) 
    taken = []
    for line in paid["items"]:
        if await products_db.decrement_stock(line["product_id"], line["quantity"]):
            taken.append(line)
            continue

        for t in taken:
            await products_db.restock(t["product_id"], t["quantity"])
        refunded = await refund_payment(razorpay_payment_id, paid["amount"])
        await orders_db.mark_status(
            rzp_id,
            "refunded" if refunded else "needs_review",
            f"out of stock: {line['name']}",
        )
        log.error ("order %s unfulfillable (%s), refunded=%s", order_ref(paid), line["name"], refunded)
        return serialize_order(await orders_db.get_by_razorpay_order_id(rzp_id))
    
    await cart_db.clear_cart(paid["user_id"])
    return serialize_order(paid) 


# -------------------------------------------------------------- endpoints

@router.post("/webhook", include_in_schema=False)
async def razorpay_webhook(request: Request):
    secret = settings.RAZORPAY_WEBHOOK_SECRET
    if not secret:
        raise HTTPException(503, "webhook not configured")

    raw = await request.body()
    received = request.headers.get("X-Razorpay-Signature", "")
    expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    if not signatures_match(expected, received):
        raise HTTPException(400, "invalid webhook signature")
    
    event = json.loads(raw)
    if event.get("event") == "order.paid":
        payload = event["payload"]
        rzp_order_id = payload["order"]["entity"]["id"]
        payment_id = payload["payment"]["entity"]["id"]
        order = await orders_db.get_by_razorpay_order_id(rzp_order_id)
        if order:
            await fulfil(order, payment_id)
        return {"status": "ok"}


@router.post("/create-order", response_model=CreateOrderOut)
async def create_order(body: CreateOrderIn, user: dict = Depends(get_current_user)):
    key_id, key_secret = require_test_keys()  # validate keys once, up front
    dbg("create_order: key_id=%s secret=%s (len=%d)", key_id, mask(key_secret), len(key_secret))

    user_id = str(user["_id"])
    cart = await cart_db.get_cart(user_id)
    if not cart["items"]:
        raise HTTPException(400, "cart is empty")

    lines, amount = await price_cart(cart["items"])
    if amount < MIN_AMOUNT:
        raise HTTPException(400, "order total is below the minimum payable amount")

    order_id = ObjectId()
    rzp = await create_razorpay_order(
        amount,
        receipt=str(order_id),
        notes={"user_id": user_id, "order_id": str(order_id)},
        key_id=key_id,
        key_secret=key_secret,
    )

    await orders_db.create_order(
        {
            "_id": order_id,
            "user_id": user_id,
            "items": lines,
            "amount": amount,
            "currency": settings.PAYMENT_CURRENCY,
            "razorpay_order_id": rzp["id"],
            "delivery_address": body.address.model_dump(), 
        }
    )
    dbg("create_order: saved order %s with razorpay_order_id=%s", order_id, rzp["id"])

    return CreateOrderOut(
        order_id=str(order_id),
        razorpay_order_id=rzp["id"],
        amount=amount,
        currency=settings.PAYMENT_CURRENCY,
        key_id=key_id,
    )


@router.post("/verify", response_model=OrderOut)
async def verify_payment(body: VerifyPaymentIn, user: dict = Depends(get_current_user)):
    dbg("verify: START body order_id=%r payment_id=%r signature=%r",
        body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)

    # Look up by razorpay order id AND current user, so nobody can verify
    # someone else's order.
    order = await orders_db.get_by_razorpay_order_id(
        body.razorpay_order_id, user_id=str(user["_id"])
    )
    if order is None:
        dbg("verify: no order found for razorpay_order_id=%r user=%s",
            body.razorpay_order_id, user["_id"])
        raise HTTPException(404, "order not found")
    dbg("verify: order found, stored razorpay_order_id=%r", order["razorpay_order_id"])

    _, key_secret = require_test_keys()
    message = f"{order['razorpay_order_id']}|{body.razorpay_payment_id}"
    expected = make_signature(
        order["razorpay_order_id"], body.razorpay_payment_id, key_secret
    )
    received = body.razorpay_signature

    dbg("verify: message string = %r", message)
    dbg("verify: secret on server = %s | len=%d | repr=%r",
        mask(key_secret), len(key_secret), key_secret[:2] + "..." + key_secret[-2:])
    dbg("verify: secret has leading/trailing space or quote? %s",
        key_secret != key_secret.strip() or key_secret[0] in "\"'" or key_secret[-1] in "\"'")
    dbg("verify: expected = %s (len=%d)", expected, len(expected))
    dbg("verify: received = %s (len=%d)", received, len(received))
    dbg("verify: payment_id in body matches the one you signed? body=%r",
        body.razorpay_payment_id)
    dbg("verify: MATCH = %s", signatures_match(expected, received))

    if not signatures_match(expected, received):
        raise HTTPException(400, "invalid payment signature")

    return await fulfil(order, body.razorpay_payment_id)


@orders_router.get("", response_model=List[OrderOut])
async def my_orders(user: dict = Depends(get_current_user)):
    orders = await orders_db.list_for_user(str(user["_id"]))
    return [serialize_order(o) for o in orders]