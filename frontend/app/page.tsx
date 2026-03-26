"use client";

import { useEffect, useRef, useState } from "react";
import ControlPanel, { type ControlSnapshot } from "./components/ControlPanel";
import SentimentTester from "./components/SentimentTester";

type Tweet = {
  text: string;
  sentiment: number;
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
  rate: 0.3,
  running: false,
  serviceReachable: false,
  pending: false,
  initialized: false,
  error: null,
};

function formatSpeedMode(rate: number): SpotlightMode {
  if (rate <= 0.3) {
    return "slow";
  }

  if (rate <= 0.6) {
    return "medium";
  }

  return "fast";
}

function formatSpeedLabel(rate: number) {
  if (rate <= 0.3) {
    return "Slow";
  }

  if (rate <= 0.6) {
    return "Medium";
  }

  return "Fast";
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
    <div className="rounded-[20px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-center">
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
      </div>
      <p className="max-h-[7.5rem] overflow-hidden text-sm leading-6 text-[var(--muted-strong)]">{tweet.text}</p>
    </article>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, positive: 0, negative: 0 });
  const [feed, setFeed] = useState<Tweet[]>([]);
  const [socketState, setSocketState] = useState<SocketState>("connecting");
  const [controlSnapshot, setControlSnapshot] = useState<ControlSnapshot>(initialControlSnapshot);

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

        prevStats.current = currentStats;

        setStats(currentStats);
        setFeed(Array.isArray(data.feed) ? data.feed : []);
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
  const targetRate = controlSnapshot.rate;
  const spotlightMode = formatSpeedMode(targetRate);
  const backendOnline = socketState === "live" && controlSnapshot.serviceReachable;

  const systemStatusLabel = backendOnline ? "Status: Online" : "Status: Offline";

  return (
    <main className="min-h-[100dvh]">
      <a href="#dashboard-content" className="skip-link focus-ring">
        Skip to dashboard
      </a>

      <div className="mx-auto flex w-full max-w-[1520px] flex-col items-center gap-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-10">
        <header className="flex w-full max-w-[980px] flex-col items-center gap-5 text-center">
          <div>
            <p className="label-kicker">Real-time sentiment dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">TweetCheck</h1>
          </div>

          <div className="status-pill">
            <span className={`status-orb ${backendOnline ? "status-orb-online" : "status-orb-offline"}`} aria-hidden="true" />
            <span className="text-sm font-medium text-[var(--muted-strong)]">{systemStatusLabel}</span>
          </div>
        </header>

        <section className="surface-panel w-full max-w-[1180px] rounded-[28px] p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Metric
              label="Processed"
              value={compactNumber.format(totalCount)}
              detail={`${totalCount.toLocaleString()} classifications`}
            />
            <Metric
              label="Sentiment split"
              value={`${positiveShare.toFixed(1)}%`}
              detail={`Negative ${negativeShare.toFixed(1)}%`}
            />
            <Metric
              label="Target"
              value={controlSnapshot.running ? formatSpeedLabel(controlSnapshot.rate) : "Paused"}
              detail={controlSnapshot.serviceReachable ? "Control reachable" : "Control unavailable"}
            />
          </div>
        </section>

        <div
          id="dashboard-content"
          className="grid w-full max-w-[1260px] gap-6 xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(260px,300px)] xl:items-start"
        >
          <aside className="order-2 xl:order-1">
            <ControlPanel onStatusChange={setControlSnapshot} />
          </aside>

          <section className="surface-panel order-1 rounded-[32px] p-5 sm:p-6 xl:order-2">
            <div className="flex flex-col items-center gap-3 border-b border-[var(--border-soft)] pb-5 text-center lg:flex-row lg:justify-between lg:text-left">
              <div className="lg:max-w-[32rem]">
                <h2 className="text-[2rem] font-semibold tracking-[-0.05em] text-white">Live Stream</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">Tweets appear one at a time as they are classified.</p>
              </div>

              <div className="flex flex-wrap gap-3 text-sm">
                <span className="rounded-full border border-[rgba(var(--accent-rgb),0.22)] px-4 py-2 text-[var(--accent-strong)]">
                  <span className="numeric font-semibold">{positiveShare.toFixed(1)}%</span> positive
                </span>
              </div>
            </div>

            <div className="mt-6">
              {currentTweet ? (
                <article
                  key={`${currentTweet.text}-${currentTweet.sentiment}`}
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
                  </div>

                  <p className="mt-6 max-w-4xl text-balance text-center text-3xl font-medium leading-[1.15] tracking-[-0.04em] text-white sm:text-4xl">
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
