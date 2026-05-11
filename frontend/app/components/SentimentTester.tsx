"use client";

import { useState } from "react";

const ANALYZE_URL = "http://localhost:8000/analyze";

type SentimentResponse = {
  sentiment: "positive" | "negative";
  label: number;
  confidence: number;
  text: string;
};

export default function SentimentTester() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SentimentResponse | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = text.trim();
    if (!trimmed) {
      setError("Type a sentence first.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: trimmed }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? "Sentiment check failed.");
      }

      const data = (await response.json()) as SentimentResponse;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sentiment check failed.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="surface-panel rounded-[14px] p-7">
      <div>
        <div className="font-headline text-[1.65rem] font-extrabold tracking-[-0.04em] text-[var(--foreground)]">Sentiment Check</div>
        <p className="mt-3 text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--muted-strong)]">Model Testing Tool</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-5">
        <label className="sr-only" htmlFor="sentiment-input">
          Sentence
        </label>
        <textarea
          id="sentiment-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type a sentence here..."
          rows={3}
          className="focus-ring min-h-30 resize-none rounded-[10px] border border-[var(--panel-border)] bg-[var(--surface-low)] px-4 py-4 text-base leading-7 text-[var(--foreground)] outline-none transition placeholder:text-[color:rgba(185,190,211,0.72)]"
        />

        <div className="flex flex-col gap-3">
          <button
            type="submit"
            disabled={loading}
            className="focus-ring inline-flex min-h-12 items-center justify-center rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface-bright)] px-5 py-3 text-base font-bold text-[var(--foreground)] transition hover:border-[var(--muted-strong)] hover:bg-[var(--surface-lowest)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Checking..." : "Check sentiment"}
          </button>

          {result ? (
            <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--panel-border)] bg-[var(--surface-high)] px-4 py-3">
              <div
                className={`inline-flex items-center rounded-[8px] border px-3 py-1 text-sm font-bold ${
                  result.sentiment === "positive"
                    ? "border-[rgba(var(--positive-rgb),0.2)] bg-[rgba(var(--positive-rgb),0.1)] text-[var(--positive)]"
                    : "border-[rgba(var(--negative-rgb),0.2)] bg-[rgba(var(--negative-rgb),0.1)] text-[var(--negative)]"
                }`}
              >
                {result.sentiment === "positive" ? "Positive" : "Negative"}
              </div>
              <div className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--panel-border)] bg-[var(--surface)] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-strong)]">
                <span>Model Confidence</span>
                <span className="numeric text-sm text-[var(--foreground)]">{(result.confidence * 100).toFixed(1)}%</span>
              </div>
            </div>
          ) : null}
        </div>
      </form>

      {error ? (
        <div className="mt-4 rounded-[10px] border border-[rgba(var(--negative-rgb),0.22)] bg-[rgba(var(--negative-rgb),0.08)] px-4 py-3 text-sm text-[var(--negative-strong)]">
          {error}
        </div>
      ) : null}
    </section>
  );
}
