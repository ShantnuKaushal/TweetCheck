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
    <section className="surface-panel rounded-[30px] p-5 sm:p-6">
      <div className="text-center">
        <div className="text-[1.35rem] font-semibold tracking-[-0.04em] text-white">Sentiment Check</div>
        <p className="mt-2 text-sm text-[var(--muted)]">Type a sentence and check the model response.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        <label className="sr-only" htmlFor="sentiment-input">
          Sentence
        </label>
        <textarea
          id="sentiment-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type a sentence here..."
          rows={3}
          className="focus-ring min-h-[96px] rounded-[18px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-white outline-none placeholder:text-[var(--muted)]"
        />

        <div className="flex flex-col gap-3">
          <button
            type="submit"
            disabled={loading}
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-full bg-[rgba(var(--accent-rgb),0.18)] px-5 py-3 text-sm font-semibold text-[var(--accent-strong)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Checking..." : "Check sentiment"}
          </button>

          {result ? (
            <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
              <div
                className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
                  result.sentiment === "positive"
                    ? "bg-[rgba(var(--accent-rgb),0.14)] text-[var(--accent-strong)]"
                    : "bg-[rgba(243,140,118,0.14)] text-[var(--danger)]"
                }`}
              >
                {result.sentiment === "positive" ? "Positive" : "Negative"}
              </div>
              <div className="numeric text-sm text-[var(--muted-strong)]">{(result.confidence * 100).toFixed(1)}%</div>
            </div>
          ) : null}
        </div>
      </form>

      {error ? (
        <div className="mt-4 rounded-[18px] border border-[rgba(243,140,118,0.22)] bg-[rgba(243,140,118,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}
    </section>
  );
}
