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

	"github.com/IBM/sarama"
)

const (
	DataPath   = "../../data/simulation_dataset.csv"
	Port       = ":8080"
	KafkaTopic = "tweets"
	KafkaURL   = "localhost:9092"
)

var (
	control   = Control{Rate: 10, Running: false}
	controlMx sync.Mutex
)

type Tweet struct {
	Sentiment int    `json:"sentiment"`
	Text      string `json:"text"`
	Timestamp int64  `json:"timestamp"`
}

type Control struct {
	Rate    int  `json:"rate"`
	Running bool `json:"running"`
}

func main() {
	fmt.Println("TweetCheck Firehose Service Starting...")

	producer := setupKafkaProducer()
	defer producer.Close()

	go firehose(producer)

	http.HandleFunc("/control", handleControl)
	http.HandleFunc("/status", handleStatus)

	fmt.Printf("Server listening on localhost%s\n", Port)
	log.Fatal(http.ListenAndServe(Port, nil))
}

func setupKafkaProducer() sarama.SyncProducer {
	config := sarama.NewConfig()
	config.Producer.Return.Successes = true
	
	for i := 0; i < 10; i++ {
		producer, err := sarama.NewSyncProducer([]string{KafkaURL}, config)
		if err == nil {
			fmt.Println("Connected to Kafka!")
			return producer
		}
		time.Sleep(2 * time.Second)
	}
	log.Fatal("Could not connect to Kafka")
	return nil
}

func firehose(producer sarama.SyncProducer) {
	f, err := os.Open(DataPath)
	if err != nil {
		log.Printf("Error opening data: %v", err)
		return
	}
	defer f.Close()

	reader := csv.NewReader(f)
	_, _ = reader.Read()

	count := 0

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
			Timestamp: time.Now().UnixMilli(),
		}

		tweetJSON, _ := json.Marshal(tweet)

		msg := &sarama.ProducerMessage{
			Topic: KafkaTopic,
			Value: sarama.StringEncoder(tweetJSON),
		}

		producer.SendMessage(msg)

		count++
		if count%100 == 0 {
			fmt.Printf("[Rate: %d/s] Pushed %d tweets\n", rate, count)
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

	fmt.Printf("Control Updated: Running=%v, Rate=%d/sec\n", control.Running, control.Rate)
	w.WriteHeader(http.StatusOK)
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	controlMx.Lock()
	defer controlMx.Unlock()
	json.NewEncoder(w).Encode(control)
}