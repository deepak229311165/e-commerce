import hashlib, hmac, json, sys
import httpx
from src.config import Settings

settings = Settings()
SECRET = settings.RAZORPAY_WEBHOOK_SECRET
rzp_order_id = sys.argv[1]

body = json.dumps({
    "event": "order.paid",
    "payload": {
        "order":   {"entity": {"id": rzp_order_id}},
        "payment": {"entity": {"id": "pay_TEST123456"}},
    }
}).encode()

sig = hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
r = httpx.post(
    "http://localhost:8000/payments/webhook",
    content=body,
    headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"},
)

print(r.status_code, r.text)