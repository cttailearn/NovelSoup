import asyncio
import websockets

async def test():
    try:
        print("Connecting to ws://127.0.0.1:8001/ws/novel...")
        async with websockets.connect("ws://127.0.0.1:8001/ws/novel") as ws:
            print(f"Connected! State: {ws.state}")
            msg = await asyncio.wait_for(ws.recv(), timeout=5)
            print(f"Received: {msg}")
    except Exception as e:
        print(f"Error: {type(e).__name__}: {e}")

asyncio.run(test())