import pandas as pd
import os

# Path setup
current_dir = os.path.dirname(os.path.abspath(__file__))
data_dir = os.path.join(os.path.dirname(current_dir), "data")

INPUT_FILE = os.path.join(data_dir, "tweets.csv")
TRAIN_FILE = os.path.join(data_dir, "train_dataset.csv")
SIM_FILE = os.path.join(data_dir, "simulation_dataset.csv")

def process_data():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found.")
        return

    print("Loading dataset...")
    cols = ["sentiment", "id", "date", "query", "user", "text"]
    
    # Read CSV (Sentiment140 uses specific encoding)
    df = pd.read_csv(INPUT_FILE, encoding="ISO-8859-1", names=cols)
    
    # Map 4 (Positive) to 1, 0 (Negative) stays 0
    df['sentiment'] = df['sentiment'].replace(4, 1)
    df = df[['sentiment', 'text']]

    print("Shuffling and splitting...")
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)

    split_idx = int(len(df) * 0.8)
    train_df = df.iloc[:split_idx]
    sim_df = df.iloc[split_idx:]

    print(f"Saving {len(train_df)} training rows and {len(sim_df)} simulation rows...")
    train_df.to_csv(TRAIN_FILE, index=False)
    sim_df.to_csv(SIM_FILE, index=False)
    
    print("Done.")

if __name__ == "__main__":
    process_data()