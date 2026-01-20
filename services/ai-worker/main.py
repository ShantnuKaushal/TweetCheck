import os
import json
import torch
import redis
import time
from kafka import KafkaConsumer
from transformers import BertTokenizer, BertForSequenceClassification

# Config
KAFKA_TOPIC = "tweets"
KAFKA_BROKER = "localhost:9092"
REDIS_HOST = "localhost"
REDIS_PORT = 6379
MODEL_PATH = "./model"

# Redis Keys
KEY_STATS = "tweetcheck:stats"
KEY_LATEST = "tweetcheck:latest"
KEY_LAG = "tweetcheck:lag"

def main():
    print("AI Worker Starting...")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using Device: {device}")

    try:
        tokenizer = BertTokenizer.from_pretrained(MODEL_PATH)
        model = BertForSequenceClassification.from_pretrained(MODEL_PATH)
        model.to(device)
        model.eval()
        print("✅ Model Loaded.")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return

    try:
        r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        r.ping()
        print("✅ Connected to Redis.")
    except Exception as e:
        print(f"❌ Redis Failed: {e}")
        return

    consumer = KafkaConsumer(
        KAFKA_TOPIC,
        bootstrap_servers=KAFKA_BROKER,
        auto_offset_reset='latest',
        enable_auto_commit=True,
        value_deserializer=lambda x: json.loads(x.decode('utf-8'))
    )
    print("✅ Connected to Kafka.")

    count = 0
    for message in consumer:
        tweet = message.value
        text = tweet['text']
        timestamp = tweet.get('timestamp', 0)
        
        # Calculate Lag
        current_time = int(time.time() * 1000)
        lag_ms = max(0, current_time - timestamp)
        lag_seconds = round(lag_ms / 1000, 2)

        # Inference
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=64, padding="max_length")
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = model(**inputs)
            prediction = torch.argmax(outputs.logits, dim=1).item()

        # Update Redis
        pipe = r.pipeline()
        
        pipe.hincrby(KEY_STATS, "total", 1)
        if prediction == 1:
            pipe.hincrby(KEY_STATS, "positive", 1)
        else:
            pipe.hincrby(KEY_STATS, "negative", 1)
            
        pipe.set(KEY_LAG, lag_seconds)

        result_json = json.dumps({
            "text": text,
            "sentiment": prediction,
            "lag": lag_seconds
        })
        pipe.lpush(KEY_LATEST, result_json)
        pipe.ltrim(KEY_LATEST, 0, 49)
        
        pipe.execute()

        count += 1
        if count % 50 == 0:
             sent_str = "🟢 POSITIVE" if prediction == 1 else "🔴 NEGATIVE"
             print(f"[{count}] {sent_str} (Lag: {lag_seconds}s)")

if __name__ == "__main__":
    main()