"use client";
import { useState, useEffect } from "react";

export default function ControlPanel() {
  const [rate, setRate] = useState(10);
  const [running, setRunning] = useState(false); // Default to False (Off)

  // 1. On Load: Ask Go Backend for current status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("http://localhost:8080/status");
        const data = await res.json();
        setRunning(data.running);
        setRate(data.rate);
      } catch (e) {
        console.error("Backend offline?", e);
      }
    };
    fetchStatus();
  }, []);

  const updateBackend = async (newRate: number, isRunning: boolean) => {
    try {
      await fetch("http://localhost:8080/control", {
        method: "POST",
        body: JSON.stringify({ rate: newRate, running: isRunning }),
      });
    } catch (e) {
      console.error("Failed to talk to Go Backend", e);
    }
  };

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setRate(val);
    updateBackend(val, running);
  };

  const togglePower = () => {
    const newState = !running;
    setRunning(newState);
    updateBackend(rate, newState);
  };

  return (
    <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg shadow-lg">
      <h3 className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-4">
        Ingestion Control
      </h3>

      <div className="flex items-center space-x-4 mb-4">
        <button
          onClick={togglePower}
          className={`px-4 py-2 rounded font-bold text-xs uppercase transition-colors ${
            running ? "bg-red-900 text-red-100 hover:bg-red-800" : "bg-green-900 text-green-100 hover:bg-green-800"
          }`}
        >
          {running ? "STOP SYSTEM" : "START SYSTEM"}
        </button>
        <div className="text-gray-300 text-sm font-mono">
          STATUS: <span className={running ? "text-green-500" : "text-red-500"}>
            {running ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs font-mono text-gray-400">
          <span>SPEED</span>
          <span className="text-blue-400">{rate} Tweets/s</span>
        </div>
        <input
          type="range"
          min="1"
          max="500"
          value={rate}
          onChange={handleSlider}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>
    </div>
  );
}