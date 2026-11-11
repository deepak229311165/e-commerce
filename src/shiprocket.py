import httpx
from src.config import Settings

settings = Settings()

SHIPROCKET_API = "https://apiv2.shiprocket.in/v1/external"

async def get_shiprocket_token():
    if not settings.SHIPROCKET_EMAIL or not settings.SHIPROCKET_PASSWORD:
        raise Exception("SHIPROCKET credentials are missing in .env")

    url = f"{SHIPROCKET_API}/auth/login"

    payload = {
        "email": settings.SHIPROCKET_EMAIL,
        "password": settings.SHIPROCKET_PASSWORD,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(url, json=payload)
    if response.status_code!= 200:
        raise Exception(f"shiprocket login failed: {response.text}")

    data = response.json()
    token = data.get("token")
    if not token:
        raise Exception("shiprocket token was not returned")
    return token    