"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Activity, ArrowUpRight, Wifi, WifiOff } from "lucide-react";
import ControlPanel, { type ControlSnapshot } from "./components/ControlPanel";

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
  label: string;
  positiveRate: number;
  negativeRate: number;
  lag: number;
};

type SocketState = "connecting" | "live" | "offline";

const WS_URL = "ws://localhost:8000/ws";
const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const ThroughputChart = dynamic(() => import("./components/ThroughputChart"), {
  ssr: false,
  loading: () => <div className="chart-placeholder h-full min-h-[260px] rounded-[22px]" />,
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
    return { label: "Healthy", tone: "text-[var(--accent-strong)]" };
  }

  if (lag <= 1) {
    return { label: "Stable", tone: "text-[var(--sky)]" };
  }

  if (lag <= 2) {
    return { label: "Under load", tone: "text-[var(--warning)]" };
  }

  return { label: "Degraded", tone: "text-[var(--danger)]" };
}

function FeedCard({ tweet }: { tweet: Tweet }) {
  const positive = tweet.sentiment === 1;

  return (
    <article className="feed-row rounded-[20px] px-4 py-4">
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
        <div className="numeric text-right text-xs text-[var(--muted)]">
          <div>lag</div>
          <div className="mt-1 text-sm font-semibold text-white">{tweet.lag.toFixed(2)}s</div>
        </div>
      </div>
      <p className="text-sm leading-6 text-[var(--muted-strong)]">{tweet.text}</p>
    </article>
  );
}

function Metric({
  label,
  value,
  detail,
  accent = "border-[var(--border-soft)]",
}: {
  label: string;
  value: string;
  detail: string;
  accent?: string;
}) {
  return (
    <div className={`rounded-[20px] border ${accent} bg-[rgba(255,255,255,0.03)] px-4 py-4`}>
      <div className="label-kicker">{label}</div>
      <div className="numeric mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">{value}</div>
      <div className="mt-1 text-sm text-[var(--muted)]">{detail}</div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, positive: 0, negative: 0 });
  const [feed, setFeed] = useState<Tweet[]>([]);
  const [lag, setLag] = useState(0);
  const [graphData, setGraphData] = useState<GraphPoint[]>([]);
  const [socketState, setSocketState] = useState<SocketState>("connecting");
  const [controlSnapshot, setControlSnapshot] = useState<ControlSnapshot>(initialControlSnapshot);

  const prevStats = useRef<Stats>({ total: 0, positive: 0, negative: 0 });
  const pointCounter = useRef(0);

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
        setLag(Number(data.lag ?? 0));
        setSocketState("live");

        const positiveDelta = currentStats.positive - prevStats.current.positive;
        const negativeDelta = currentStats.negative - prevStats.current.negative;

        prevStats.current = currentStats;
        pointCounter.current += 1;

        setGraphData((previous) => {
          const nextPoint: GraphPoint = {
            label: String(pointCounter.current),
            positiveRate: Math.max(0, positiveDelta * 10),
            negativeRate: Math.max(0, negativeDelta * 10),
            lag: Number(data.lag ?? 0),
          };

          return [...previous, nextPoint].slice(-24);
        });
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
  const lagState = formatLagState(lag);
  const latestPoint = graphData.at(-1);
  const currentThroughput = latestPoint ? latestPoint.positiveRate + latestPoint.negativeRate : 0;

  const firehoseLabel = !controlSnapshot.initialized
    ? "Checking"
    : !controlSnapshot.serviceReachable
      ? "Offline"
      : controlSnapshot.running
        ? `Live at ${controlSnapshot.rate}/s`
        : "Standby";

  const telemetryLabel =
    socketState === "live" ? "Telemetry live" : socketState === "connecting" ? "Connecting" : "Telemetry offline";

  const feedHeading =
    socketState === "live" ? "Live feed" : socketState === "offline" ? "Feed unavailable" : "Preparing live feed";

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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Processed"
              value={compactNumber.format(totalCount)}
              detail={`${totalCount.toLocaleString()} classifications`}
              accent="border-[rgba(111,181,255,0.22)]"
            />
            <Metric
              label="Lag"
              value={`${lag.toFixed(2)}s`}
              detail={lagState.label}
              accent="border-[rgba(241,196,122,0.22)]"
            />
            <Metric
              label="Positive"
              value={`${positiveShare.toFixed(1)}%`}
              detail={`Negative ${negativeShare.toFixed(1)}%`}
              accent="border-[rgba(var(--accent-rgb),0.22)]"
            />
            <Metric
              label="Target"
              value={controlSnapshot.running ? `${controlSnapshot.rate}/s` : "Paused"}
              detail={controlSnapshot.serviceReachable ? "Control reachable" : "Control unavailable"}
              accent="border-[rgba(243,140,118,0.22)]"
            />
          </div>
        </section>

        <div id="dashboard-content" className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="surface-panel rounded-[30px] p-5 sm:p-6">
            <div className="flex flex-col gap-4 border-b border-[var(--border-soft)] pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-[2rem] font-semibold tracking-[-0.05em] text-white">Throughput</h2>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center rounded-full border border-[var(--border-soft)] px-4 py-2 text-sm text-white">
                  <span className="numeric font-semibold">{currentThroughput.toFixed(1)}/s</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.22)] px-4 py-2 text-sm text-white">
                  <ArrowUpRight className="h-4 w-4 text-[var(--accent-strong)]" />
                  <span className="numeric font-semibold">{positiveShare.toFixed(1)}%</span>
                </div>
                <div className={`inline-flex items-center rounded-full border border-[var(--border-soft)] px-4 py-2 text-sm font-semibold ${lagState.tone}`}>
                  {lagState.label}
                </div>
              </div>
            </div>

            <div className="chart-shell mt-5 h-[280px] sm:h-[300px]">
              <ThroughputChart data={graphData} />
            </div>

            <div className="mt-5 border-t border-[var(--border-soft)] pt-5">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-[var(--muted-strong)]">Positive</span>
                    <span className="numeric text-sm font-semibold text-white">{positiveShare.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,rgba(111,181,255,0.4),rgba(202,245,229,0.95))] transition-[width] duration-500"
                      style={{ width: `${positiveShare}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-[var(--muted-strong)]">Negative</span>
                    <span className="numeric text-sm font-semibold text-white">{negativeShare.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,rgba(243,140,118,0.55),rgba(255,184,110,0.95))] transition-[width] duration-500"
                      style={{ width: `${negativeShare}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <ControlPanel onStatusChange={setControlSnapshot} />
          </section>

          <aside className="surface-panel rounded-[30px] p-5 sm:p-6">
            <div className="border-b border-[var(--border-soft)] pb-4">
              <div>
                <h2 className="text-[2rem] font-semibold tracking-[-0.05em] text-white">
                  {socketState === "live" ? "Live Feed" : feedHeading}
                </h2>
              </div>
            </div>

            <div className="mt-5">
              {feed.length > 0 ? (
                <div className="feed-scroll flex max-h-[620px] flex-col gap-3 overflow-y-auto pr-1">
                  {feed.map((tweet, index) => (
                    <FeedCard key={`${tweet.text}-${index}`} tweet={tweet} />
                  ))}
                </div>
              ) : (
                <div className="rounded-[22px] border border-[var(--border-soft)] px-4 py-8 text-sm text-[var(--muted)]">
                  {socketState === "offline"
                    ? "Waiting for the dashboard API."
                    : controlSnapshot.running
                      ? "Waiting for the first classified tweet."
                      : "Start the ingestion service to begin filling the live feed."}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
