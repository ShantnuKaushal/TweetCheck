package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"
)

const (
	DataPath = "../../data/simulation_dataset.csv"
	Port     = ":8080"
)

var (
	control    = Control{Rate: 10, Running: false}
	controlMx  sync.Mutex
)

type Tweet struct {
	Sentiment int    `json:"sentiment"`
	Text      string `json:"text"`
}

type Control struct {
	Rate    int  `json:"rate"`
	Running bool `json:"running"`
}

func main() {
	fmt.Println("TweetCheck Firehose Service Starting...")

	go firehose()

	http.HandleFunc("/control", handleControl)
	http.HandleFunc("/status", handleStatus)
	
	fmt.Printf("Server listening on localhost%s\n", Port)
	log.Fatal(http.ListenAndServe(Port, nil))
}

func firehose() {
	f, err := os.Open(DataPath)
	if err != nil {
		log.Printf("❌ Error opening data: %v", err)
		return
	}
	defer f.Close()

	reader := csv.NewReader(f)
	_, _ = reader.Read() // Skip header

	for {
		controlMx.Lock()
		rate := control.Rate
		running := control.Running
		controlMx.Unlock()

		if !running {
			time.Sleep(1 * time.Second)
			continue
		}

		sleepDuration := time.Duration(1000000/rate) * time.Microsecond

		record, err := reader.Read()
		if err != nil {
			f.Seek(0, 0)
			_, _ = reader.Read()
			continue
		}

		sent, _ := strconv.Atoi(record[0])
		tweet := Tweet{
			Sentiment: sent,
			Text:      record[1],
		}

		// Mock output - In Phase 4 we replace this with Kafka
		if time.Now().UnixMilli() % 100 == 0 {
			fmt.Printf("[Rate: %d/s] Sending: %s\n", rate, tweet.Text)
		}
		
		time.Sleep(sleepDuration)
	}
}

func handleControl(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var newControl Control
	if err := json.NewDecoder(r.Body).Decode(&newControl); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	controlMx.Lock()
	control = newControl
	controlMx.Unlock()

	fmt.Printf("Updated: Running=%v, Rate=%d/sec\n", control.Running, control.Rate)
	w.WriteHeader(http.StatusOK)
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	controlMx.Lock()
	defer controlMx.Unlock()
	json.NewEncoder(w).Encode(control)
}