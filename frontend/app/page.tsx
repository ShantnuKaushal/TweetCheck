"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Wifi, WifiOff } from "lucide-react";
import ControlPanel, { type ControlSnapshot } from "./components/ControlPanel";
import SentimentTester from "./components/SentimentTester";

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

type SocketState = "connecting" | "live" | "offline";
type SpotlightMode = "slow" | "medium" | "fast";

const WS_URL = "ws://localhost:8000/ws";
const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const initialControlSnapshot: ControlSnapshot = {
  rate: 10,
  running: false,
  serviceReachable: false,
  pending: false,
  initialized: false,
  error: null,
};

function formatLagState(lag: number) {
  if (lag <= 0.35) {
    return "Healthy";
  }

  if (lag <= 1) {
    return "Stable";
  }

  if (lag <= 2) {
    return "Under load";
  }

  return "Degraded";
}

function formatSpeedMode(rate: number): SpotlightMode {
  if (rate <= 30) {
    return "slow";
  }

  if (rate <= 120) {
    return "medium";
  }

  return "fast";
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
      <div className="label-kicker">{label}</div>
      <div className="numeric mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">{value}</div>
      <div className="mt-1 text-sm text-[var(--muted)]">{detail}</div>
    </div>
  );
}

function RecentTweet({ tweet }: { tweet: Tweet }) {
  const positive = tweet.sentiment === 1;

  return (
    <article className="feed-row rounded-[18px] px-4 py-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
            positive
              ? "bg-[rgba(var(--accent-rgb),0.14)] text-[var(--accent-strong)]"
              : "bg-[rgba(243,140,118,0.14)] text-[var(--danger)]"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${positive ? "bg-[var(--accent-strong)]" : "bg-[var(--danger)]"}`} />
          {positive ? "Positive" : "Negative"}
        </span>
        <div className="numeric text-sm text-[var(--muted)]">{tweet.lag.toFixed(2)}s</div>
      </div>
      <p className="max-h-[7.5rem] overflow-hidden text-sm leading-6 text-[var(--muted-strong)]">{tweet.text}</p>
    </article>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, positive: 0, negative: 0 });
  const [feed, setFeed] = useState<Tweet[]>([]);
  const [lag, setLag] = useState(0);
  const [socketState, setSocketState] = useState<SocketState>("connecting");
  const [controlSnapshot, setControlSnapshot] = useState<ControlSnapshot>(initialControlSnapshot);
  const [currentRate, setCurrentRate] = useState(0);

  const prevStats = useRef<Stats>({ total: 0, positive: 0, negative: 0 });

  useEffect(() => {
    let active = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let socket: WebSocket | null = null;

    const connect = () => {
      if (!active) {
        return;
      }

      setSocketState("connecting");
      socket = new WebSocket(WS_URL);

      socket.onmessage = (event) => {
        if (!active) {
          return;
        }

        const data = JSON.parse(event.data) as {
          stats: Record<string, string>;
          feed: Tweet[];
          lag: number;
        };

        const currentStats = {
          total: Number(data.stats.total ?? 0),
          positive: Number(data.stats.positive ?? 0),
          negative: Number(data.stats.negative ?? 0),
        };

        const positiveDelta = currentStats.positive - prevStats.current.positive;
        const negativeDelta = currentStats.negative - prevStats.current.negative;

        prevStats.current = currentStats;

        setStats(currentStats);
        setFeed(Array.isArray(data.feed) ? data.feed : []);
        setLag(Number(data.lag ?? 0));
        setCurrentRate(Math.max(0, (positiveDelta + negativeDelta) * 10));
        setSocketState("live");
      };

      socket.onclose = () => {
        if (!active) {
          return;
        }

        setSocketState("offline");
        reconnectTimer = setTimeout(connect, 2500);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      active = false;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      socket?.close();
    };
  }, []);

  const totalCount = stats.total;
  const positiveShare = totalCount > 0 ? (stats.positive / totalCount) * 100 : 0;
  const negativeShare = totalCount > 0 ? (stats.negative / totalCount) * 100 : 0;
  const currentTweet = feed[0] ?? null;
  const recentTweets = feed.slice(1, 4);
  const targetRate = controlSnapshot.running ? controlSnapshot.rate : currentRate;
  const spotlightMode = formatSpeedMode(targetRate);

  const firehoseLabel = !controlSnapshot.initialized
    ? "Checking"
    : !controlSnapshot.serviceReachable
      ? "Offline"
      : controlSnapshot.running
        ? `Live at ${controlSnapshot.rate}/s`
        : "Standby";

  const telemetryLabel =
    socketState === "live" ? "Telemetry live" : socketState === "connecting" ? "Connecting" : "Telemetry offline";

  return (
    <main className="min-h-[100dvh]">
      <a href="#dashboard-content" className="skip-link focus-ring">
        Skip to dashboard
      </a>

      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="label-kicker">Real-time sentiment dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">TweetCheck</h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(111,181,255,0.22)] bg-[rgba(111,181,255,0.06)] px-4 py-2 text-sm text-[var(--muted-strong)]">
              {socketState === "live" ? (
                <Wifi className="h-4 w-4 text-[var(--sky)]" />
              ) : (
                <WifiOff className="h-4 w-4 text-[var(--warning)]" />
              )}
              {telemetryLabel}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.22)] bg-[rgba(var(--accent-rgb),0.06)] px-4 py-2 text-sm text-[var(--muted-strong)]">
              <Activity className="h-4 w-4 text-[var(--accent-strong)]" />
              {firehoseLabel}
            </div>
          </div>
        </header>

        <section className="surface-panel rounded-[28px] p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Metric
              label="Processed"
              value={compactNumber.format(totalCount)}
              detail={`${totalCount.toLocaleString()} classifications`}
            />
            <Metric
              label="Lag"
              value={`${lag.toFixed(2)}s`}
              detail={formatLagState(lag)}
            />
            <Metric
              label="Sentiment split"
              value={`${positiveShare.toFixed(1)}%`}
              detail={`Negative ${negativeShare.toFixed(1)}%`}
            />
          </div>
        </section>

        <div id="dashboard-content" className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
          <aside className="order-2 xl:order-1">
            <ControlPanel onStatusChange={setControlSnapshot} />
          </aside>

          <section className="surface-panel order-1 rounded-[32px] p-5 sm:p-6 xl:order-2">
            <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] pb-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-[2rem] font-semibold tracking-[-0.05em] text-white">Live Stream</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">Tweets appear one at a time as they are classified.</p>
              </div>

              <div className="flex flex-wrap gap-3 text-sm">
                <span className="rounded-full border border-[var(--border-soft)] px-4 py-2 text-white">
                  <span className="numeric font-semibold">{currentRate.toFixed(1)}/s</span>
                </span>
                <span className="rounded-full border border-[rgba(var(--accent-rgb),0.22)] px-4 py-2 text-[var(--accent-strong)]">
                  <span className="numeric font-semibold">{positiveShare.toFixed(1)}%</span> positive
                </span>
              </div>
            </div>

            <div className="mt-6">
              {currentTweet ? (
                <article
                  key={`${currentTweet.text}-${currentTweet.sentiment}-${currentTweet.lag}`}
                  className={`spotlight-card spotlight-${spotlightMode} ${currentTweet.sentiment === 1 ? "spotlight-positive" : "spotlight-negative"}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                        currentTweet.sentiment === 1
                          ? "bg-[rgba(var(--accent-rgb),0.16)] text-[var(--accent-strong)]"
                          : "bg-[rgba(243,140,118,0.16)] text-[var(--danger)]"
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          currentTweet.sentiment === 1 ? "bg-[var(--accent-strong)]" : "bg-[var(--danger)]"
                        }`}
                      />
                      {currentTweet.sentiment === 1 ? "Positive" : "Negative"}
                    </span>
                    <span className="numeric text-sm text-[var(--muted)]">{currentTweet.lag.toFixed(2)}s lag</span>
                  </div>

                  <p className="mt-6 max-w-4xl text-balance text-3xl font-medium leading-[1.15] tracking-[-0.04em] text-white sm:text-4xl">
                    {currentTweet.text}
                  </p>
                </article>
              ) : (
                <div className="spotlight-empty">
                  {socketState === "offline"
                    ? "Waiting for the dashboard API."
                    : controlSnapshot.running
                      ? "Waiting for the first classified tweet."
                      : "Start the firehose to begin the live stream."}
                </div>
              )}
            </div>

            {recentTweets.length > 0 ? (
              <div className="mt-6 border-t border-[var(--border-soft)] pt-5">
                <div className="label-kicker">Recent</div>
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  {recentTweets.map((tweet, index) => (
                    <RecentTweet key={`${tweet.text}-${index}`} tweet={tweet} />
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <aside className="order-3 xl:order-3">
            <SentimentTester />
          </aside>
        </div>
      </div>
    </main>
  );
}
