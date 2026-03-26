"use client";

import { useCallback, useEffect, useState } from "react";

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
  rate: 10,
  running: false,
  serviceReachable: false,
  pending: false,
  initialized: false,
  error: null,
};

export default function ControlPanel({ onStatusChange }: ControlPanelProps) {
  const [snapshot, setSnapshot] = useState<ControlSnapshot>(initialSnapshot);
  const [draftRate, setDraftRate] = useState(initialSnapshot.rate);

  useEffect(() => {
    onStatusChange?.(snapshot);
  }, [onStatusChange, snapshot]);

  useEffect(() => {
    setDraftRate(snapshot.rate);
  }, [snapshot.rate]);

  const syncStatus = useCallback(async () => {
    try {
      const response = await fetch(CONTROL_STATUS_URL);

      if (!response.ok) {
        throw new Error("Control service unavailable");
      }

      const data = (await response.json()) as { rate: number; running: boolean };

      setSnapshot((current) => ({
        ...current,
        rate: Number(data.rate ?? current.rate),
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

    setSnapshot((current) => ({
      ...current,
      rate: nextRate,
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
        body: JSON.stringify({ rate: nextRate, running: nextRunning }),
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
    if (draftRate !== snapshot.rate) {
      void updateBackend(draftRate, snapshot.running);
    }
  }, [draftRate, snapshot.rate, snapshot.running, updateBackend]);

  const handleSlider = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDraftRate(Number(event.target.value));
  };

  const togglePower = () => {
    void updateBackend(snapshot.rate, !snapshot.running);
  };

  const helperText = snapshot.running
    ? `${snapshot.rate}/sec streaming`
    : snapshot.serviceReachable
      ? "Start the stream to begin processing."
      : "Control API unavailable.";

  return (
    <section className="surface-panel rounded-[30px] p-5 sm:p-6">
      <div className="flex flex-col gap-5">
        <div>
          <div className="text-[1.35rem] font-semibold tracking-[-0.04em] text-white">Control</div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{helperText}</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-white">Speed</span>
            <span className="numeric text-sm text-[var(--muted-strong)]">{draftRate}/sec</span>
          </div>
          <input
            type="range"
            min="1"
            max="500"
            value={draftRate}
            onChange={handleSlider}
            onMouseUp={commitRate}
            onTouchEnd={commitRate}
            onKeyUp={commitRate}
            disabled={snapshot.pending}
            className="control-slider focus-ring cursor-pointer"
            aria-label="Set ingestion speed"
          />
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            <span>1</span>
            <span>250</span>
            <span>500</span>
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
