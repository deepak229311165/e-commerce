import asyncio

from src.shiprocket import get_shiprocket_token

async def main():
    try:
        token = await get_shiprocket_token()

        if token:
            print("Shiprocket authentication successful. ")
            print("api token received")

    except Exception as e:
        print("Shiprocket authentication failed:", str(e))

asyncio.run(main())