# TweetCheck: Distributed Sentiment Analysis Engine

TweetCheck is a high-throughput, fault-tolerant distributed system designed to ingest, process, and visualize social media sentiment in real-time. It mimics the architecture of large-scale data pipelines used by companies like Twitter/X or Bloomberg, utilizing a "Firehose" architecture to stress-test deep learning inference capabilities.

## Architecture

The system follows a microservices event-driven architecture designed to handle high-velocity data streams:

1. Ingestion Service (Golang): A high-performance producer that reads from a 1.6M tweet dataset and "fires" them into the network. It uses a concurrency-safe control loop to adjust ingestion rates dynamically.
2. Event Bus (Apache Kafka): Acts as the central nervous system, buffering high-speed incoming data to ensure the system remains fault-tolerant and decoupled.
3. AI Workers (Python + PyTorch): Distributed consumers that pull tweets from Kafka. They perform real-time inference using a fine-tuned BERT (Bidirectional Encoder Representations from Transformers) model.
4. State Store (Redis): An in-memory database used for atomic counters and real-time state management (sentiment ratios and system lag).
5. Dashboard API (FastAPI): A WebSocket gateway that broadcasts live metrics and the processed "Firehose" feed to the client.
6. Frontend (Next.js + Tailwind): A dashboard providing real-time visualization of sentiment trends and system performance metrics.

## Tech Stack

* Languages: Golang 1.24 (Ingestion), Python 3.10 (AI & API), TypeScript (Frontend)
* AI/ML: PyTorch, HuggingFace Transformers, BERT (Full version)
* Messaging: Apache Kafka, Zookeeper
* Database: Redis
* Frontend: Next.js 15, Tailwind CSS, Recharts, Lucide Icons
* Orchestration: Docker, Docker Compose
* CI/CD: GitHub Actions

## Project Structure

```text
TweetCheck/
├── data/                 # Raw and split datasets (CSV)
├── services/
│   ├── go-ingestion/     # Golang Firehose Service
│   ├── ai-worker/        # Python AI (Kafka Consumer + BERT)
│   └── dashboard-api/    # FastAPI WebSocket Service
├── training/             # Offline Model Training Scripts
├── frontend/             # Next.js Web Dashboard
├── .github/              # GitHub Actions CI/CD Workflows
└── docker-compose.yaml   # Full System Orchestration
```
## Getting Started

### 1. Data Preparation
Place your raw tweets.csv (Sentiment140 dataset) in the data/ folder and run the split script:
python training/setup_data.py

### 2. Model Training
This script will fine-tune the model and save it to services/ai-worker/model/.
python training/train.py

### 3. Launch the System
Run the entire distributed engine with a single command from the root directory:
docker-compose up --build

## System Features

### Real-Time Sentiment Pulse
The dashboard visualizes positive vs. negative sentiment trends using a live-updating line chart. The BERT model analyzes each tweet's context to assign sentiment with high accuracy.

### Performance Monitoring (System Lag)
The system calculates "Lag" by comparing the ingestion timestamp with the processing timestamp. This allows you to monitor exactly how many seconds the AI is behind the live stream.


## CI/CD
This project utilizes GitHub Actions to ensure code quality. Every push to the main branch triggers an automated build process that verifies the Docker compatibility and compilation of all microservices (Go, Python, and Next.js).