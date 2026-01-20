import json
import asyncio
import os
import redis.asyncio as redis
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Docker Aware Config
redis_host = os.getenv("REDIS_HOST", "localhost")
REDIS_URL = f"redis://{redis_host}:6379"

print(f"Dashboard API connecting to Redis at: {REDIS_URL}")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    r = redis.from_url(REDIS_URL, decode_responses=True)
    
    try:
        while True:
            stats = await r.hgetall("tweetcheck:stats")
            if not stats:
                stats = {"total": 0, "positive": 0, "negative": 0}
            
            feed = await r.lrange("tweetcheck:latest", 0, 10)
            feed_data = [json.loads(t) for t in feed]

            lag = await r.get("tweetcheck:lag")
            if not lag: 
                lag = 0

            payload = {
                "stats": stats,
                "feed": feed_data,
                "lag": float(lag)
            }

            await websocket.send_json(payload)
            await asyncio.sleep(0.1)

    except Exception as e:
        print(f"WebSocket Error: {e}")
    finally:
        await r.close()

@app.get("/health")
def health():
    return {"status": "ok"}