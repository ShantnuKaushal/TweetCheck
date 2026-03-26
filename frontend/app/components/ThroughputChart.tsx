"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ThroughputChartProps = {
  data: Array<{
    label: string;
    positiveRate: number;
    negativeRate: number;
    lag: number;
  }>;
};

export default function ThroughputChart({ data }: ThroughputChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
      <ComposedChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="positiveArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(76,169,131,0.48)" />
            <stop offset="100%" stopColor="rgba(76,169,131,0.02)" />
          </linearGradient>
          <linearGradient id="negativeArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(201,108,99,0.34)" />
            <stop offset="100%" stopColor="rgba(201,108,99,0.02)" />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--grid-line)" strokeDasharray="4 10" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={false} />
        <YAxis
          yAxisId="rate"
          tickLine={false}
          axisLine={false}
          width={26}
          tick={{ fill: "var(--muted)", fontSize: 11 }}
        />
        <YAxis yAxisId="lag" hide />
        <Tooltip
          contentStyle={{
            borderRadius: "18px",
            border: "1px solid rgba(76, 169, 131, 0.16)",
            background: "rgba(12, 19, 16, 0.96)",
            boxShadow: "0 24px 50px rgba(3, 8, 6, 0.35)",
          }}
          cursor={{ stroke: "rgba(76, 169, 131, 0.18)", strokeWidth: 1 }}
          labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
          itemStyle={{ color: "var(--muted-strong)" }}
          formatter={(value, name) => {
            if (typeof value !== "number") {
              return [value ?? "n/a", name];
            }

            if (name === "Lag") {
              return [`${value.toFixed(2)}s`, name];
            }

            return [`${value.toFixed(1)}/s`, name];
          }}
        />
        <Area
          yAxisId="rate"
          type="monotone"
          dataKey="positiveRate"
          name="Positive rate"
          stroke="var(--positive-strong)"
          strokeWidth={2}
          fill="url(#positiveArea)"
          isAnimationActive={false}
        />
        <Area
          yAxisId="rate"
          type="monotone"
          dataKey="negativeRate"
          name="Negative rate"
          stroke="var(--negative)"
          strokeWidth={2}
          fill="url(#negativeArea)"
          isAnimationActive={false}
        />
        <Line
          yAxisId="lag"
          type="monotone"
          dataKey="lag"
          name="Lag"
          stroke="var(--lag-line)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
