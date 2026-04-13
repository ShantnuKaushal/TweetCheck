"use client";

import { type ReactNode, useEffect, useState } from "react";
import { MoonStar, SunMedium } from "lucide-react";
import ControlPanel, { type ControlSnapshot } from "./components/ControlPanel";
import SentimentTester from "./components/SentimentTester";

type Tweet = {
  text: string;
  sentiment: number;
  confidence?: number;
};

type Stats = {
  total: number;
  positive: number;
  negative: number;
};

type SocketState = "connecting" | "live" | "offline";
type SpotlightMode = "slow" | "medium" | "fast";
type ThemeMode = "dark" | "light";

const WS_URL = "ws://localhost:8000/ws";
const THEME_STORAGE_KEY = "tweetcheck-theme";
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

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
}) {
  return (
    <div className="metric-card rounded-[1.5rem] border border-[var(--panel-border)] bg-[var(--surface)] px-6 py-8 text-center shadow-[0_12px_30px_rgba(2,12,20,0.16)]">
      <div className="label-kicker">{label}</div>
      <div className="numeric mt-4 text-5xl font-black tracking-[-0.06em] text-[var(--foreground)]">{value}</div>
      {detail ? <div className="mt-3">{detail}</div> : null}
    </div>
  );
}

function SentimentSplitMetric({
  positiveShare,
  negativeShare,
}: {
  positiveShare: number;
  negativeShare: number;
}) {
  return (
    <div className="metric-card rounded-[1.5rem] border border-[var(--panel-border)] bg-[var(--surface)] px-6 py-8">
      <div className="label-kicker text-center">Sentiment split</div>

      <div className="mt-5 flex items-center justify-center gap-8 sm:gap-12">
        <div className="metric-side">
          <div className="metric-side-label">
            <span className="metric-dot metric-dot-positive" aria-hidden="true" />
            Positive
          </div>
          <div className="numeric mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--foreground)]">{positiveShare.toFixed(1)}%</div>
        </div>

        <div className="h-14 w-px bg-[var(--divider)]" aria-hidden="true" />

        <div className="metric-side">
          <div className="metric-side-label">
            <span className="metric-dot metric-dot-negative" aria-hidden="true" />
            Negative
          </div>
          <div className="numeric mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--foreground)]">{negativeShare.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
}

function RecentTweet({ tweet }: { tweet: Tweet }) {
  const positive = tweet.sentiment === 1;

  return (
    <article className={`feed-row rounded-[1.25rem] px-6 py-6 ${positive ? "feed-row-positive" : "feed-row-negative"}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
            positive
              ? "border-[rgba(var(--positive-rgb),0.2)] bg-[rgba(var(--positive-rgb),0.1)] text-[var(--positive)]"
              : "border-[rgba(var(--negative-rgb),0.2)] bg-[rgba(var(--negative-rgb),0.1)] text-[var(--negative)]"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${positive ? "bg-[var(--positive)]" : "bg-[var(--negative)]"}`} />
          {positive ? "Positive" : "Negative"}
        </span>
      </div>
      <p className="max-h-[8rem] overflow-hidden text-sm leading-7 text-[var(--muted)]">{tweet.text}</p>
    </article>
  );
}

function formatConfidence(confidence?: number) {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) {
    return "N/A";
  }

  return `${(confidence * 100).toFixed(1)}%`;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, positive: 0, negative: 0 });
  const [feed, setFeed] = useState<Tweet[]>([]);
  const [socketState, setSocketState] = useState<SocketState>("connecting");
  const [controlSnapshot, setControlSnapshot] = useState<ControlSnapshot>(initialControlSnapshot);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "dark";
    }

    return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

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
  const confidenceValue =
    typeof currentTweet?.confidence === "number" && !Number.isNaN(currentTweet.confidence)
      ? Math.max(0, Math.min(100, currentTweet.confidence * 100))
      : 0;
  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };
  const themeLabel = theme === "dark" ? "Light Theme" : "Dark Theme";
  const ThemeIcon = theme === "dark" ? SunMedium : MoonStar;

  return (
    <main className="min-h-[100dvh]">
      <a href="#dashboard-content" className="skip-link focus-ring">
        Skip to dashboard
      </a>

      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex w-full flex-col items-center gap-4 pt-2 text-center">
          <div>
            <h1 className="font-headline mt-1 text-4xl font-black tracking-[-0.06em] text-[var(--foreground)] sm:text-[3.25rem]">TweetCheck</h1>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="status-pill">
              <span className={`status-orb ${backendOnline ? "status-orb-online" : "status-orb-offline"}`} aria-hidden="true" />
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--foreground)]">{systemStatusLabel}</span>
            </div>

            <button type="button" onClick={toggleTheme} className="theme-toggle focus-ring" aria-label={`Switch to ${themeLabel.toLowerCase()}`}>
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted-strong)]">{themeLabel}</span>
              <span className="theme-toggle-thumb" aria-hidden="true">
                <ThemeIcon className="h-4 w-4" />
              </span>
            </button>
          </div>
        </header>

        <section className="w-full">
          <div className="grid gap-4 md:grid-cols-2">
            <Metric label="Processed" value={compactNumber.format(totalCount)} />
            <SentimentSplitMetric positiveShare={positiveShare} negativeShare={negativeShare} />
          </div>
        </section>

        <div id="dashboard-content" className="grid w-full items-start gap-8 lg:grid-cols-12">
          <section className="surface-panel lg:col-span-9 rounded-[2rem] p-5 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-3 border-b border-[var(--panel-border)] pb-5 text-center md:flex-row md:items-start md:justify-between md:text-left">
              <div>
                <h2 className="font-headline text-[2rem] font-black tracking-[-0.05em] text-[var(--foreground)]">Tweet Stream</h2>
                <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">Tweets appear one at a time as each result comes in.</p>
              </div>

              <div className="flex justify-center md:justify-end">
                <div className="flex items-center gap-3 rounded-full px-1 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted-strong)]">
                  <span>Model Confidence</span>
                  <div className="h-1.5 w-18 overflow-hidden rounded-full bg-[var(--slider-track)] shadow-[inset_0_1px_2px_rgba(15,23,42,0.14)]">
                    <div
                      className="h-full rounded-full bg-[var(--positive)] shadow-[0_0_14px_rgba(var(--positive-rgb),0.28)]"
                      style={{ width: `${confidenceValue}%` }}
                    />
                  </div>
                  <span className="numeric text-[var(--foreground)]">{formatConfidence(currentTweet?.confidence)}</span>
                </div>
              </div>
            </div>

            <div className="mt-8">
              {currentTweet ? (
                <article
                  key={`${currentTweet.text}-${currentTweet.sentiment}`}
                  className={`spotlight-card spotlight-${spotlightMode} ${currentTweet.sentiment === 1 ? "spotlight-positive" : "spotlight-negative"}`}
                >
                  <div className="absolute left-8 top-8 flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                        currentTweet.sentiment === 1
                          ? "border-[rgba(var(--positive-rgb),0.2)] bg-[rgba(var(--positive-rgb),0.1)] text-[var(--positive)]"
                          : "border-[rgba(var(--negative-rgb),0.2)] bg-[rgba(var(--negative-rgb),0.1)] text-[var(--negative)]"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          currentTweet.sentiment === 1 ? "bg-[var(--positive)]" : "bg-[var(--negative)]"
                        }`}
                      />
                      {currentTweet.sentiment === 1 ? "Positive" : "Negative"}
                    </span>
                  </div>

                  <p className="font-headline max-w-4xl text-balance text-left text-3xl font-bold leading-[1.14] tracking-[-0.05em] text-[var(--foreground)] sm:text-4xl lg:text-[3.45rem]">
                    {currentTweet.text}
                  </p>
                </article>
              ) : (
                <div className="spotlight-empty">
                  {socketState === "offline"
                      ? "Waiting for the dashboard API."
                      : controlSnapshot.running
                        ? "Waiting for the first classified tweet."
                      : "Start the firehose to begin the tweet stream."}
                </div>
              )}
            </div>

            {recentTweets.length > 0 ? (
              <div className="mt-8">
                <div className="mb-6 border-b border-[var(--panel-border)] pb-4">
                  <div className="section-caption">Recent Activity</div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {recentTweets.map((tweet, index) => (
                    <RecentTweet key={`${tweet.text}-${index}`} tweet={tweet} />
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <aside className="space-y-8 lg:col-span-3">
            <ControlPanel onStatusChange={setControlSnapshot} />
            <SentimentTester />
          </aside>
        </div>
      </div>
    </main>
  );
}
