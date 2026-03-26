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

  const updateBackend = useCallback(async (nextRate: number, nextRunning: boolean) => {
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
  }, [snapshot]);

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

  return (
    <section className="surface-panel rounded-[30px] p-5 sm:p-6">
      <div className="flex flex-col gap-5">
        <div className="text-center">
          <div className="text-[1.35rem] font-semibold tracking-[-0.04em] text-white">Control</div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{helperText}</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-white">Speed</span>
            <span className="text-sm text-[var(--muted-strong)]">{draftLabel}</span>
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
          <div className="grid grid-cols-3 gap-2 text-xs text-[var(--muted)]">
            <div className={`flex items-center gap-2 ${draftStep === 0 ? "text-[var(--accent-strong)]" : ""}`}>
              <Turtle className="h-4 w-4" />
              <span>Slow</span>
            </div>
            <div className={`flex items-center justify-center gap-2 ${draftStep === 1 ? "text-[var(--accent-strong)]" : ""}`}>
              <Rabbit className="h-4 w-4" />
              <span>Medium</span>
            </div>
            <div className={`flex items-center justify-end gap-2 ${draftStep === 2 ? "text-[var(--accent-strong)]" : ""}`}>
              <Zap className="h-4 w-4" />
              <span>Fast</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={togglePower}
          disabled={snapshot.pending}
          className={`focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 py-3 text-center text-sm font-semibold leading-none whitespace-nowrap transition ${
            snapshot.running
              ? "bg-[rgba(243,140,118,0.14)] text-[var(--danger)] hover:-translate-y-0.5"
              : "bg-[rgba(var(--accent-rgb),0.18)] text-[var(--accent-strong)] hover:-translate-y-0.5"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {snapshot.running ? "Stop" : "Start"}
        </button>

        {snapshot.error ? <div className="text-sm text-[var(--danger)]">{snapshot.error}</div> : null}
      </div>
    </section>
  );
}
