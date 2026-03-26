import json
import asyncio
import os
from functools import lru_cache

import torch
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import BertForSequenceClassification, BertTokenizer

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

redis_host = os.getenv("REDIS_HOST", "localhost")
REDIS_URL = f"redis://{redis_host}:6379"
MODEL_PATH = "/app/model" if os.path.exists("/app/model") else "../ai-worker/model"
DEVICE = torch.device("cpu")

print(f"Dashboard API connecting to Redis at: {REDIS_URL}")
print(f"Dashboard API loading model from: {MODEL_PATH}")

class SentimentRequest(BaseModel):
    text: str

@lru_cache(maxsize=1)
def get_model_bundle():
    tokenizer = BertTokenizer.from_pretrained(MODEL_PATH)
    model = BertForSequenceClassification.from_pretrained(MODEL_PATH)
    model.to(DEVICE)
    model.eval()
    return tokenizer, model

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

@app.post("/analyze")
def analyze_sentiment(payload: SentimentRequest):
    text = payload.text.strip()

    if not text:
        raise HTTPException(status_code=400, detail="Text is required.")

    tokenizer, model = get_model_bundle()
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=64,
        padding="max_length"
    )

    with torch.no_grad():
        outputs = model(**inputs)
        probabilities = torch.softmax(outputs.logits, dim=1)[0]
        prediction = torch.argmax(probabilities).item()

    confidence = round(float(probabilities[prediction].item()), 4)

    return {
        "sentiment": "positive" if prediction == 1 else "negative",
        "label": prediction,
        "confidence": confidence,
        "text": text,
    }
