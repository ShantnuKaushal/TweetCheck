import os
import json
import torch
import redis
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

def main():
    print("AI Worker Starting...")

    # 1. Setup Device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using Device: {device}")

    # 2. Load Model
    print("Loading BERT Model...")
    try:
        tokenizer = BertTokenizer.from_pretrained(MODEL_PATH)
        model = BertForSequenceClassification.from_pretrained(MODEL_PATH)
        model.to(device)
        model.eval() # Set to evaluation mode (faster)
        print("✅ Model Loaded Successfully.")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        print("Did you run the training script? Is the 'model' folder there?")
        return

    # 3. Connect Redis
    try:
        r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        r.ping()
        print("✅ Connected to Redis.")
    except Exception as e:
        print(f"❌ Redis Connection Failed: {e}")
        return

    # 4. Connect Kafka
    print("Connecting to Kafka...")
    consumer = KafkaConsumer(
        KAFKA_TOPIC,
        bootstrap_servers=KAFKA_BROKER,
        auto_offset_reset='latest',
        enable_auto_commit=True,
        value_deserializer=lambda x: json.loads(x.decode('utf-8'))
    )
    print("✅ Connected to Kafka. Waiting for tweets...")

    # 5. Processing Loop
    count = 0
    for message in consumer:
        tweet = message.value
        text = tweet['text']
        
        # Inference (The Brain)
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=64, padding="max_length")
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = model(**inputs)
            prediction = torch.argmax(outputs.logits, dim=1).item()
            # 0 = Negative, 1 = Positive

        # Update Redis (Atomic Pipeline)
        pipe = r.pipeline()
        
        # Increment counters
        pipe.hincrby(KEY_STATS, "total", 1)
        if prediction == 1:
            pipe.hincrby(KEY_STATS, "positive", 1)
        else:
            pipe.hincrby(KEY_STATS, "negative", 1)
            
        # Push to "Live Feed" list (Keep only last 50)
        result_json = json.dumps({
            "text": text,
            "sentiment": prediction
        })
        pipe.lpush(KEY_LATEST, result_json)
        pipe.ltrim(KEY_LATEST, 0, 49)
        
        pipe.execute()

        # Log every 50th tweet so we can see it working
        count += 1
        if count % 50 == 0:
             sent_str = "🟢 POSITIVE" if prediction == 1 else "🔴 NEGATIVE"
             print(f"[{count}] {sent_str}: {text[:40]}...")

if __name__ == "__main__":
    main()