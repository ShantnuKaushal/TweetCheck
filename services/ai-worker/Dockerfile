FROM python:3.10-slim

WORKDIR /app
RUN apt-get update && apt-get install -y gcc
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir pandas numpy transformers scikit-learn kafka-python-ng redis

COPY . .
CMD ["python", "main.py"]
