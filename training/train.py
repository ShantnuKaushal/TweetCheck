import os
import torch
import pandas as pd
from torch.utils.data import Dataset, DataLoader
from transformers import BertTokenizer, BertForSequenceClassification
from torch.optim import AdamW
from tqdm import tqdm

# Configuration
BATCH_SIZE = 32
EPOCHS = 1
LEARNING_RATE = 2e-5
MAX_LEN = 64
MODEL_NAME = 'bert-base-uncased'

# Paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
data_path = os.path.join(project_root, "data", "train_dataset.csv")
output_dir = os.path.join(project_root, "services", "ai-worker", "model")

# Device Setup
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

class SentimentDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_len):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, item):
        text = str(self.texts[item])
        label = self.labels[item]

        encoding = self.tokenizer.encode_plus(
            text,
            add_special_tokens=True,
            max_length=self.max_len,
            return_token_type_ids=False,
            padding='max_length',
            truncation=True,
            return_attention_mask=True,
            return_tensors='pt',
        )

        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': torch.tensor(label, dtype=torch.long)
        }

def train():
    print(f"Using Device: {device}")
    
    print("Loading data...")
    df = pd.read_csv(data_path)
    
    tokenizer = BertTokenizer.from_pretrained(MODEL_NAME)
    
    dataset = SentimentDataset(
        texts=df.text.to_numpy(),
        labels=df.sentiment.to_numpy(),
        tokenizer=tokenizer,
        max_len=MAX_LEN
    )
    
    data_loader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)

    print("Downloading BERT model...")
    model = BertForSequenceClassification.from_pretrained(MODEL_NAME, num_labels=2)
    model = model.to(device)
    
    optimizer = AdamW(model.parameters(), lr=LEARNING_RATE)

    print(f"Starting training for {EPOCHS} epoch(s)...")
    model.train()

    for epoch in range(EPOCHS):
        loop = tqdm(data_loader, leave=True)
        for batch in loop:
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            labels = batch['labels'].to(device)

            optimizer.zero_grad()
            
            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=labels
            )
            
            loss = outputs.loss
            loss.backward()
            optimizer.step()

            loop.set_description(f"Epoch {epoch + 1}")
            loop.set_postfix(loss=loss.item())

    print(f"Saving model to {output_dir}...")
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    
    print("Model saved successfully!")

if __name__ == "__main__":
    train()