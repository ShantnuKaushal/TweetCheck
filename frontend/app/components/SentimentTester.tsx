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
    <section className="surface-panel rounded-[2rem] p-6 sm:p-8">
      <div className="text-center">
        <div className="font-headline text-[1.65rem] font-black tracking-[-0.05em] text-white">Sentiment Check</div>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--muted)]">Model Testing Tool</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        <label className="sr-only" htmlFor="sentiment-input">
          Sentence
        </label>
        <textarea
          id="sentiment-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type a sentence here..."
          rows={3}
          className="focus-ring min-h-32 resize-none rounded-[1.25rem] border border-[rgba(71,85,105,0.3)] bg-[var(--surface-low)] px-5 py-4 text-sm leading-7 text-white outline-none transition placeholder:text-[color:rgba(148,163,184,0.45)]"
        />

        <div className="flex flex-col gap-3">
          <button
            type="submit"
            disabled={loading}
            className="focus-ring inline-flex min-h-14 items-center justify-center rounded-[1.25rem] border border-[rgba(71,85,105,0.38)] bg-[var(--surface-high)] px-5 py-4 text-sm font-bold text-white transition hover:bg-[var(--surface-bright)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Checking..." : "Check sentiment"}
          </button>

          {result ? (
            <div className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-[rgba(30,58,77,0.55)] bg-[var(--surface-high)] px-4 py-3">
              <div
                className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold ${
                  result.sentiment === "positive"
                    ? "border-[rgba(var(--positive-rgb),0.2)] bg-[rgba(var(--positive-rgb),0.1)] text-[var(--positive)]"
                    : "border-[rgba(var(--negative-rgb),0.2)] bg-[rgba(var(--negative-rgb),0.1)] text-[var(--negative)]"
                }`}
              >
                {result.sentiment === "positive" ? "Positive" : "Negative"}
              </div>
              <div className="numeric text-sm font-bold text-[var(--muted-strong)]">{(result.confidence * 100).toFixed(1)}%</div>
            </div>
          ) : null}
        </div>
      </form>

      {error ? (
        <div className="mt-4 rounded-[1.25rem] border border-[rgba(var(--negative-rgb),0.22)] bg-[rgba(var(--negative-rgb),0.08)] px-4 py-3 text-sm text-[var(--negative-strong)]">
          {error}
        </div>
      ) : null}
    </section>
  );
}
