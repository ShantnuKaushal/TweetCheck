"use client";

import { useCallback, useEffect, useState } from "react";
import { Rabbit, Turtle, Zap } from "lucide-react";

const CONTROL_STATUS_URL = "http://localhost:8080/status";
const CONTROL_UPDATE_URL = "http://localhost:8080/control";

export type ControlSnapshot = {
  rate: number;
  running: boolean;
  serviceReachable: boolean;
  pending: boolean;
  initialized: boolean;
  error: string | null;
};

type ControlPanelProps = {
  onStatusChange?: (snapshot: ControlSnapshot) => void;
};

const initialSnapshot: ControlSnapshot = {
  rate: 0.3,
  running: false,
  serviceReachable: false,
  pending: false,
  initialized: false,
  error: null,
};

const SPEED_PRESETS = [0.3, 0.6, 1.0] as const;
const SPEED_LABELS = ["Slow", "Medium", "Fast"] as const;

function rateToStep(rate: number) {
  if (rate < 0.45) {
    return 0;
  }
  if (rate < 0.8) {
    return 1;
  }
  return 2;
}

function stepToRate(step: number) {
  return SPEED_PRESETS[Math.min(2, Math.max(0, step))];
}

export default function ControlPanel({ onStatusChange }: ControlPanelProps) {
  const [snapshot, setSnapshot] = useState<ControlSnapshot>(initialSnapshot);
  const [draftStep, setDraftStep] = useState(0);

  useEffect(() => {
    onStatusChange?.(snapshot);
  }, [onStatusChange, snapshot]);

  useEffect(() => {
    setDraftStep(rateToStep(snapshot.rate));
  }, [snapshot.rate]);

  const syncStatus = useCallback(async () => {
    try {
      const response = await fetch(CONTROL_STATUS_URL);

      if (!response.ok) {
        throw new Error("Control service unavailable");
      }

      const data = (await response.json()) as { rate: number; running: boolean };
      const nextRate = stepToRate(rateToStep(Number(data.rate ?? initialSnapshot.rate)));

      setSnapshot((current) => ({
        ...current,
        rate: nextRate,
        running: Boolean(data.running),
        serviceReachable: true,
        pending: false,
        initialized: true,
        error: null,
      }));
    } catch {
      setSnapshot((current) => ({
        ...current,
        serviceReachable: false,
        pending: false,
        initialized: true,
        error: "Control service unreachable",
      }));
    }
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!active) {
        return;
      }

      await syncStatus();
    };

    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 8000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [syncStatus]);

  const updateBackend = useCallback(
    async (nextRate: number, nextRunning: boolean) => {
      const previous = snapshot;
      const safeRate = stepToRate(rateToStep(nextRate));

      setSnapshot((current) => ({
        ...current,
        rate: safeRate,
        running: nextRunning,
        pending: true,
        error: null,
      }));

      try {
        const response = await fetch(CONTROL_UPDATE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ rate: safeRate, running: nextRunning }),
        });

        if (!response.ok) {
          throw new Error("Failed to update control service");
        }

        setSnapshot((current) => ({
          ...current,
          serviceReachable: true,
          pending: false,
          initialized: true,
          error: null,
        }));
      } catch {
        setSnapshot({
          ...previous,
          serviceReachable: false,
          pending: false,
          initialized: true,
          error: "Control update failed",
        });
      }
    },
    [snapshot],
  );

  const commitRate = useCallback(() => {
    const safeRate = stepToRate(draftStep);
    if (safeRate !== snapshot.rate) {
      void updateBackend(safeRate, snapshot.running);
    }
  }, [draftStep, snapshot.rate, snapshot.running, updateBackend]);

  const handleSlider = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDraftStep(Number(event.target.value));
  };

  const togglePower = () => {
    void updateBackend(snapshot.rate, !snapshot.running);
  };

  const helperText = snapshot.running
    ? `${SPEED_LABELS[rateToStep(snapshot.rate)]} stream active`
    : snapshot.serviceReachable
      ? "Start the stream to begin processing."
      : "Control API unavailable.";

  const draftLabel = SPEED_LABELS[draftStep];
  const sliderProgress = draftStep === 0 ? "0%" : draftStep === 1 ? "50%" : "100%";

  return (
    <section className="surface-panel rounded-[2rem] p-6 sm:p-8">
      <div className="flex flex-col gap-8">
        <div className="text-center">
          <div className="font-headline text-[1.65rem] font-black tracking-[-0.05em] text-[var(--foreground)]">Control</div>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--muted)]">Stream Parameters</p>
        </div>

        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--foreground)]">Speed</span>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em]">
              <span className="text-[var(--muted)]">Current</span>
              <span className="text-[var(--positive)]">{draftLabel}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="slider-shell">
              <div className="slider-shell-track" aria-hidden="true">
                <div className="slider-shell-fill" style={{ width: sliderProgress }} />
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="1"
                value={draftStep}
                onChange={handleSlider}
                onMouseUp={commitRate}
                onTouchEnd={commitRate}
                onKeyUp={commitRate}
                disabled={snapshot.pending}
                className="control-slider focus-ring cursor-pointer"
                aria-label="Set ingestion speed"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
              <div className={`flex flex-col items-center gap-1 ${draftStep === 0 ? "text-[var(--muted-strong)]" : ""}`}>
                <Turtle className="h-4 w-4" />
                <span>Slow</span>
              </div>
              <div className={`flex flex-col items-center gap-1 ${draftStep === 1 ? "text-[var(--muted-strong)]" : ""}`}>
                <Rabbit className="h-4 w-4" />
                <span>Medium</span>
              </div>
              <div className={`flex flex-col items-center gap-1 ${draftStep === 2 ? "text-[var(--muted-strong)]" : ""}`}>
                <Zap className="h-4 w-4" />
                <span>Fast</span>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={togglePower}
          disabled={snapshot.pending}
          className={`focus-ring inline-flex min-h-14 w-full items-center justify-center rounded-[1.25rem] px-5 py-4 text-center text-sm font-bold leading-none whitespace-nowrap transition active:scale-[0.98] ${
            snapshot.running
              ? "border border-[rgba(var(--negative-rgb),0.26)] bg-[rgba(var(--negative-rgb),0.12)] text-[var(--negative-strong)] hover:brightness-110"
              : "bg-[var(--positive)] text-[var(--positive-on)] shadow-[0_10px_20px_var(--positive-shadow)] hover:brightness-105"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {snapshot.running ? "Stop Stream" : "Start Stream"}
        </button>

        {snapshot.error ? (
          <div className="rounded-[1rem] border border-[rgba(var(--negative-rgb),0.24)] bg-[rgba(var(--negative-rgb),0.08)] px-4 py-3 text-sm text-[var(--negative-strong)]">
            {snapshot.error}
          </div>
        ) : (
          <div className="text-center text-xs text-[var(--muted)]">{helperText}</div>
        )}
      </div>
    </section>
  );
}
