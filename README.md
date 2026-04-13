# TweetCheck: Distributed Sentiment Analysis Engine

TweetCheck is a distributed system designed to ingest, process, and visualize social media sentiment in real time. It simulates a live stream of tweets, runs sentiment inference with a fine-tuned BERT model, and displays the results through a web dashboard.

## Tech Stack

* Languages: Golang 1.24, Python 3.10, TypeScript
* AI/ML: PyTorch, HuggingFace Transformers (BERT)
* Messaging: Apache Kafka, Zookeeper
* Database: Redis
* Backend API: FastAPI, WebSockets
* Frontend: Next.js 16, React 19, Tailwind CSS 4
* Orchestration: Docker, Docker Compose
* CI: GitHub Actions

## Architecture

The system follows a microservices event-driven architecture built for real-time processing:

1. Ingestion Service (Golang): A producer that reads from the simulation dataset and pushes tweets into Kafka. It exposes simple runtime controls for starting, stopping, and changing the ingestion speed.
2. Event Bus (Apache Kafka): Buffers incoming tweet events and decouples ingestion from downstream processing.
3. AI Worker (Python + PyTorch): A consumer that reads tweets from Kafka, runs BERT sentiment inference, and writes live stats, recent tweets, and lag data to Redis.
4. State Store (Redis): Stores aggregate sentiment counts, the latest processed tweets, and current system lag.
5. Dashboard API (FastAPI): Provides a WebSocket feed for live dashboard updates and an API endpoint for manual sentiment checks.
6. Frontend (Next.js + Tailwind): A dashboard for monitoring the live stream, controlling ingestion, and testing custom text against the model.

## Project Structure

```text
TweetCheck/
|-- data/                 # Raw and prepared datasets (CSV)
|-- services/
|   |-- go-ingestion/     # Golang ingestion service
|   |-- ai-worker/        # Python AI worker (Kafka consumer + BERT)
|   `-- dashboard-api/    # FastAPI WebSocket and inference service
|-- training/             # Model training and dataset setup scripts
|-- frontend/             # Next.js web dashboard
|-- .github/              # GitHub Actions workflows
`-- docker-compose.yaml   # Full system orchestration
```

## Getting Started

### 1. Data Preparation

The repository already includes `tweets.csv`, `train_dataset.csv`, and `simulation_dataset.csv`.

If you want to regenerate the split datasets, run:

```bash
python training/setup_data.py
```

### 2. Model Training

The repository already includes a trained model in `services/ai-worker/model/`.

If you want to retrain the model, run:

```bash
python training/train.py
```

### 3. Launch the System

Run the full distributed system from the project root:

```bash
docker compose up --build
```

### 4. Open the App

- Frontend dashboard: `http://localhost:3000`
- Dashboard API: `http://localhost:8000`
- Ingestion service: `http://localhost:8080`

## System Features

### Live Sentiment Stream

The dashboard displays a live feed of classified tweets as they move through the system. Each tweet is labeled as positive or negative using the fine-tuned BERT model.

### Stream Controls

The frontend includes controls for starting and stopping the stream and switching between slow, medium, and fast ingestion speeds.

### Manual Sentiment Testing

The dashboard also includes a sentiment check panel where you can submit custom text and receive a prediction with confidence from the same model used by the worker.

### Performance Monitoring

The system tracks processing lag by comparing ingestion time with inference time and stores that value in Redis for live monitoring.

## CI

This project uses GitHub Actions to validate the system by building the Docker images for the Go service, AI worker, dashboard API, and frontend.

## Dashboard Preview

Below is a preview of the TweetCheck dashboard. It shows the live sentiment stream, ingestion controls, system status, and the built-in sentiment testing panel.
![dark-tweet-source](https://github.com/user-attachments/assets/14d8d134-6f02-4ee5-b019-721315636ddc)


