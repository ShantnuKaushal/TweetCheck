"use client";

import { useEffect, useState, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Activity, Server, Database, Zap } from "lucide-react";
import ControlPanel from "./components/ControlPanel";

// Types
type Tweet = {
  text: string;
  sentiment: number;
  lag: number;
};

type Stats = {
  total: number;
  positive: number;
  negative: number;
};

type GraphPoint = {
  time: string;
  posRate: number;
  negRate: number;
  lag: number;
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, positive: 0, negative: 0 });
  const [feed, setFeed] = useState<Tweet[]>([]);
  const [lag, setLag] = useState(0);
  const [graphData, setGraphData] = useState<GraphPoint[]>([]);
  
  // Refs for calculating rate (delta)
  const prevStats = useRef<Stats>({ total: 0, positive: 0, negative: 0 });

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // 1. Update Basic State
      const currentStats = {
        total: parseInt(data.stats.total),
        positive: parseInt(data.stats.positive),
        negative: parseInt(data.stats.negative),
      };
      setStats(currentStats);
      setFeed(data.feed);
      setLag(data.lag);

      // 2. Calculate Rate (Tweets Per Second approx) for Graph
      // Since we receive updates every 0.1s, delta * 10 = rate/sec
      const posDelta = currentStats.positive - prevStats.current.positive;
      const negDelta = currentStats.negative - prevStats.current.negative;
      
      prevStats.current = currentStats;

      setGraphData((prev) => {
        const now = new Date();
        const timeStr = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
        
        const newPoint = {
          time: timeStr,
          posRate: posDelta * 10, // approximate rate
          negRate: negDelta * 10,
          lag: data.lag
        };

        // Keep only last 20 data points
        const newData = [...prev, newPoint];
        if (newData.length > 20) newData.shift();
        return newData;
      });
    };

    return () => ws.close();
  }, []);

  return (
    <main className="min-h-screen bg-black text-gray-100 p-6 font-mono selection:bg-green-900">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <Activity className="text-green-500" />
          <h1 className="text-2xl font-bold tracking-tighter">
            TWEETCHECK <span className="text-gray-600">v1.0</span>
          </h1>
        </div>
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-blue-500" />
            <span className="text-gray-400">PROCESSED:</span>
            <span className="font-bold">{stats.total.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Server size={16} className={lag > 1 ? "text-red-500" : "text-green-500"} />
            <span className="text-gray-400">SYS LAG:</span>
            <span className={`font-bold ${lag > 1 ? "text-red-500" : "text-green-500"}`}>
              {lag.toFixed(2)}s
            </span>
          </div>
        </div>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* LEFT COL: Control & Graph (8 cols) */}
        <div className="col-span-8 space-y-6">
          
          {/* Top Cards */}
          <div className="grid grid-cols-2 gap-4">
            <ControlPanel />
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg flex flex-col justify-center">
               <div className="text-gray-400 text-xs uppercase mb-2">Sentiment Ratio</div>
               <div className="flex items-end gap-2">
                  <div className="text-4xl font-bold text-green-400">
                    {stats.total > 0 ? ((stats.positive / stats.total) * 100).toFixed(2) : 0}%
                  </div>
                  <div className="text-sm text-gray-500 mb-1">Positive</div>
               </div>
               <div className="w-full bg-gray-800 h-2 mt-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-green-500 h-full transition-all duration-500" 
                    style={{ width: `${stats.total > 0 ? (stats.positive / stats.total) * 100 : 0}%` }}
                  ></div>
               </div>
            </div>
          </div>

          {/* Graph */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 h-96">
            <h3 className="text-gray-400 text-xs uppercase font-bold mb-4 flex items-center gap-2">
              <Zap size={14} className="text-yellow-500" /> Live Throughput (Tweets/Sec)
            </h3>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={graphData}>
                <XAxis dataKey="time" stroke="#4b5563" fontSize={10} tick={false} />
                <YAxis stroke="#4b5563" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', borderColor: '#333' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="posRate" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="negRate" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RIGHT COL: The Firehose (4 cols) */}
        <div className="col-span-4 bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col h-[600px]">
          <h3 className="text-gray-400 text-xs uppercase font-bold mb-4 border-b border-gray-800 pb-2">
            Live Feed
          </h3>
          <div className="flex-1 overflow-hidden relative">
            <div className="absolute inset-0 overflow-y-auto space-y-2 pr-2">
              {feed.map((tweet, i) => (
                <div key={i} className="p-3 bg-black/50 border-l-2 border-gray-700 text-xs font-mono">
                  <div className="flex justify-between mb-1">
                    <span className={tweet.sentiment === 1 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                      {tweet.sentiment === 1 ? "POSITIVE" : "NEGATIVE"}
                    </span>
                    <span className="text-gray-600">Lag: {tweet.lag}s</span>
                  </div>
                  <p className="text-gray-300 opacity-80 leading-tight">
                    {tweet.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}