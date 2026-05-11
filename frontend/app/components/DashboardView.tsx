"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Moon, SignalHigh } from "lucide-react";
import ControlPanel, { type ControlSnapshot } from "./ControlPanel";
import SentimentTester from "./SentimentTester";

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

const DEMO_TWEETS: Tweet[] = [
  {
    text: "TweetCheck caught a spike in positive launch chatter before the weekly dashboard refreshed.",
    sentiment: 1,
    confidence: 0.934,
  },
  {
    text: "People are frustrated that checkout keeps timing out during the promo window.",
    sentiment: 0,
    confidence: 0.887,
  },
  {
    text: "Support replies were fast today and the new onboarding flow finally feels polished.",
    sentiment: 1,
    confidence: 0.961,
  },
  {
    text: "The app update broke notifications again, which makes the release feel rushed.",
    sentiment: 0,
    confidence: 0.914,
  },
  {
    text: "The live sentiment stream makes customer mood changes easy to catch without reading every post.",
    sentiment: 1,
    confidence: 0.948,
  },
  {
    text: "Several users are still reporting lag when the feed gets busy.",
    sentiment: 0,
    confidence: 0.861,
  },
];

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
    <div className="metric-card surface-panel rounded-[14px] px-6 py-8 text-center">
      <div className="label-kicker">{label}</div>
      <div className="numeric mt-5 text-[4.25rem] font-extrabold leading-none tracking-[-0.05em] text-[var(--foreground)]">{value}</div>
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
    <div className="metric-card surface-panel rounded-[14px] px-6 py-8">
      <div className="label-kicker text-center">Sentiment split</div>

      <div className="mt-7 flex items-center justify-center gap-8 sm:gap-16">
        <div className="metric-side">
          <div className="metric-side-label">
            <span className="metric-dot metric-dot-positive" aria-hidden="true" />
            Positive
          </div>
          <div className="numeric mt-3 text-[3rem] font-extrabold leading-none tracking-[-0.04em] text-[var(--positive)]">{positiveShare.toFixed(1)}%</div>
        </div>

        <div className="h-24 w-px bg-[var(--divider)]" aria-hidden="true" />

        <div className="metric-side">
          <div className="metric-side-label">
            <span className="metric-dot metric-dot-negative" aria-hidden="true" />
            Negative
          </div>
          <div className="numeric mt-3 text-[3rem] font-extrabold leading-none tracking-[-0.04em] text-[var(--negative)]">{negativeShare.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
}

function RecentTweet({ tweet }: { tweet: Tweet }) {
  const positive = tweet.sentiment === 1;

  return (
    <article className={`feed-row rounded-[12px] px-5 py-5 ${positive ? "feed-row-positive" : "feed-row-negative"}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-[8px] border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
            positive
              ? "border-[rgba(var(--positive-rgb),0.2)] bg-[rgba(var(--positive-rgb),0.1)] text-[var(--positive)]"
              : "border-[rgba(var(--negative-rgb),0.2)] bg-[rgba(var(--negative-rgb),0.1)] text-[var(--negative)]"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${positive ? "bg-[var(--positive)]" : "bg-[var(--negative)]"}`} />
          {positive ? "Positive" : "Negative"}
        </span>
      </div>
      <p className="tweet-card-text text-sm leading-7 text-[var(--muted)]">{tweet.text}</p>
    </article>
  );
}

function formatConfidence(confidence?: number) {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) {
    return "N/A";
  }

  return `${(confidence * 100).toFixed(1)}%`;
}

export default function DashboardView() {
  const [stats, setStats] = useState<Stats>({ total: 0, positive: 0, negative: 0 });
  const [feed, setFeed] = useState<Tweet[]>([]);
  const [socketState, setSocketState] = useState<SocketState>("connecting");
  const [controlSnapshot, setControlSnapshot] = useState<ControlSnapshot>(initialControlSnapshot);
  const [demoFeed, setDemoFeed] = useState<Tweet[]>([]);
  const [demoStats, setDemoStats] = useState<Stats>({ total: 0, positive: 0, negative: 0 });
  const [demoIndex, setDemoIndex] = useState(0);
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

        setStats({
          total: Number(data.stats.total ?? 0),
          positive: Number(data.stats.positive ?? 0),
          negative: Number(data.stats.negative ?? 0),
        });
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

  useEffect(() => {
    if (!controlSnapshot.running || controlSnapshot.serviceReachable) {
      if (!controlSnapshot.running) {
        const resetTimer = window.setTimeout(() => {
          setDemoFeed([]);
          setDemoStats({ total: 0, positive: 0, negative: 0 });
          setDemoIndex(0);
        }, 0);

        return () => window.clearTimeout(resetTimer);
      }
      return;
    }

    const delay = controlSnapshot.rate <= 0.3 ? 1800 : controlSnapshot.rate <= 0.6 ? 1050 : 620;
    const timer = window.setTimeout(() => {
      const baseTweet = DEMO_TWEETS[demoIndex % DEMO_TWEETS.length];
      const confidenceShift = (((Date.now() / 37) % 9) - 4) / 100;
      const nextTweet = {
        ...baseTweet,
        confidence: Math.max(0.72, Math.min(0.99, (baseTweet.confidence ?? 0.9) + confidenceShift)),
      };

      setDemoFeed((current) => [nextTweet, ...current].slice(0, 8));
      setDemoStats((current) => ({
        total: current.total + 1,
        positive: current.positive + (nextTweet.sentiment === 1 ? 1 : 0),
        negative: current.negative + (nextTweet.sentiment === 1 ? 0 : 1),
      }));
      setDemoIndex((current) => current + 1);
    }, demoFeed.length === 0 ? 120 : delay);

    return () => window.clearTimeout(timer);
  }, [controlSnapshot.rate, controlSnapshot.running, controlSnapshot.serviceReachable, demoFeed.length, demoIndex]);

  const isDemoStream = controlSnapshot.running && !controlSnapshot.serviceReachable;
  const visibleStats = isDemoStream ? demoStats : stats;
  const visibleFeed = useMemo(() => (isDemoStream ? demoFeed : feed), [demoFeed, feed, isDemoStream]);
  const totalCount = visibleStats.total;
  const positiveShare = totalCount > 0 ? (visibleStats.positive / totalCount) * 100 : 0;
  const negativeShare = totalCount > 0 ? (visibleStats.negative / totalCount) * 100 : 0;
  const currentTweet = visibleFeed[0] ?? null;
  const recentTweets = visibleFeed.slice(1, 4);
  const spotlightMode = formatSpeedMode(controlSnapshot.rate);
  const confidenceValue =
    typeof currentTweet?.confidence === "number" && !Number.isNaN(currentTweet.confidence)
      ? Math.max(0, Math.min(100, currentTweet.confidence * 100))
      : 0;
  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };
  const themeLabel = theme === "dark" ? "Light Theme" : "Dark Theme";

  return (
    <main className="min-h-[100dvh]">
      <a href="#dashboard-content" className="skip-link focus-ring">
        Skip to dashboard
      </a>

      <div className="mx-auto flex w-full max-w-[1536px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <header className="grid w-full items-center gap-4 py-1 text-center md:grid-cols-[1fr_auto_1fr]">
          <div className="hidden md:block" aria-hidden="true" />

          <div className="flex items-center justify-center">
            <h1 className="font-headline text-5xl font-extrabold leading-none tracking-[-0.055em] text-[var(--foreground)] sm:text-[4.05rem]">
              Tweet<span className="text-[var(--accent)]">Check</span>
            </h1>
          </div>

          <div className="flex justify-center md:justify-end">
            <button type="button" onClick={toggleTheme} className="theme-toggle focus-ring" aria-label="Switch theme">
              <Moon className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
              <span className="text-[13px] font-black uppercase tracking-[0.16em] text-[var(--muted-strong)]">{themeLabel}</span>
            </button>
          </div>
        </header>

        <div id="dashboard-content" className="grid w-full items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid gap-4">
            <section className="surface-panel rounded-[14px] p-6 sm:p-8 lg:p-10">
              <div className="flex flex-col gap-3 text-center md:flex-row md:items-start md:justify-between md:text-left">
                <div>
                  <h2 className="font-headline text-[1.85rem] font-extrabold tracking-[-0.04em] text-[var(--foreground)]">Tweet Stream</h2>
                  <p className="mt-2 text-base text-[var(--muted)]">Tweets appear one at a time as each result comes in.</p>
                </div>

                <div className="flex justify-center md:justify-end">
                  <div className="flex items-center gap-3 px-1 py-1 text-[13px] font-black uppercase tracking-[0.13em] text-[var(--muted-strong)]">
                    <span>Model Confidence</span>
                    <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--slider-track)] shadow-[inset_0_1px_2px_rgba(15,23,42,0.14)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)] shadow-[0_0_14px_rgba(var(--accent-rgb),0.28)] transition-[width] duration-300"
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
                    key={`${currentTweet.text}-${currentTweet.sentiment}-${currentTweet.confidence}`}
                    className={`spotlight-card spotlight-${spotlightMode} ${currentTweet.sentiment === 1 ? "spotlight-positive" : "spotlight-negative"}`}
                  >
                    <div className="absolute left-8 top-8 flex flex-wrap items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-2 rounded-[8px] border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                          currentTweet.sentiment === 1
                            ? "border-[rgba(var(--positive-rgb),0.2)] bg-[rgba(var(--positive-rgb),0.1)] text-[var(--positive)]"
                            : "border-[rgba(var(--negative-rgb),0.2)] bg-[rgba(var(--negative-rgb),0.1)] text-[var(--negative)]"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${currentTweet.sentiment === 1 ? "bg-[var(--positive)]" : "bg-[var(--negative)]"}`} />
                        {currentTweet.sentiment === 1 ? "Positive" : "Negative"}
                      </span>
                    </div>

                    <p className="spotlight-tweet-text mx-auto max-w-3xl text-balance text-center text-xl font-medium leading-8 tracking-[-0.015em] text-[var(--foreground)] sm:text-2xl">
                      {currentTweet.text}
                    </p>
                  </article>
                ) : (
                  <div className="spotlight-empty">
                    <div className="empty-signal" aria-hidden="true">
                      <SignalHigh className="h-8 w-8" strokeWidth={1.8} />
                    </div>
                    <p>
                      {socketState === "offline" && !isDemoStream
                        ? "Start the firehose to begin the tweet stream."
                        : controlSnapshot.running
                          ? "Waiting for the first classified tweet."
                          : "Start the firehose to begin the tweet stream."}
                    </p>
                  </div>
                )}
              </div>

              {recentTweets.length > 0 ? (
                <div className="mt-8">
                  <div className="mb-5 border-b border-[var(--panel-border)] pb-4">
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

            <section className="grid gap-4 md:grid-cols-[0.44fr_0.56fr]">
              <Metric label="Processed" value={compactNumber.format(totalCount)} />
              <SentimentSplitMetric positiveShare={positiveShare} negativeShare={negativeShare} />
            </section>
          </div>

          <aside className="space-y-4">
            <ControlPanel onStatusChange={setControlSnapshot} />
            <SentimentTester />
          </aside>
        </div>
      </div>
    </main>
  );
}
