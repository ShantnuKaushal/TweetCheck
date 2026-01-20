# TweetCheck: Distributed Sentiment Analysis Engine

TweetCheck is a high-throughput, fault-tolerant distributed system designed to ingest, process, and visualize social media sentiment in real-time. It mimics the architecture of large-scale data pipelines used by companies like Twitter/X or Bloomberg, utilizing a "Firehose" architecture to stress-test deep learning inference capabilities.

## 🏗 Architecture

The system follows a microservices event-driven architecture:

1.  **Ingestion Service (Golang):** Reads a massive dataset of "unseen" tweets and pushes them into the event bus at high velocity (up to 1,000+ events/sec).
2.  **Event Bus (Apache Kafka):** Acts as the high-speed buffer between ingestion and processing.
3.  **AI Workers (Python + PyTorch):** A cluster of workers consuming from Kafka. They use a fine-tuned BERT model to classify sentiment (Positive/Negative).
4.  **State Store (Redis):** Stores real-time metrics and processed results.
5.  **Dashboard API (FastAPI):** Broadcasts system health and sentiment trends via WebSockets.
6.  **Frontend (React/Dashboard):** Visualizes the "Live Pulse" and "System Lag."

## 🛠 Tech Stack

*   **Language:** Python 3.10+, Golang 1.21+
*   **ML/AI:** PyTorch, Transformers (BERT), NVIDIA CUDA
*   **Infrastructure:** Docker, Kubernetes (K8s)
*   **Messaging:** Apache Kafka, Zookeeper
*   **Storage:** Redis (Hot), CSV (Cold)
*   **CI/CD:** GitHub Actions