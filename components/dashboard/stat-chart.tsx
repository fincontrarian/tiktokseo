"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const VIOLET = "#5b45e0";
const INK = "#10131f";

export interface ChartPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface ChartEvent {
  date: string; // YYYY-MM-DD
  label: string;
}

interface StatChartProps {
  title: string;
  data: ChartPoint[];
  /** Optimization events rendered as vertical annotations. */
  events: ChartEvent[];
  format: "count" | "percent";
}

function formatValue(value: number, format: "count" | "percent"): string {
  if (format === "percent") return `${(value * 100).toFixed(2)}%`;
  return Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatMonth(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en", {
    month: "short",
    timeZone: "UTC",
  });
}

export function StatChart({ title, data, events, format }: StatChartProps) {
  const dates = new Set(data.map((point) => point.date));

  return (
    <div
      data-testid="stat-chart"
      className="border-ink/10 rounded-2xl border p-4"
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 12, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke={INK} strokeOpacity={0.08} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatMonth}
              minTickGap={40}
              tick={{ fontSize: 11, fill: INK, opacity: 0.5 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              width={52}
              tickFormatter={(v: number) => formatValue(v, format)}
              tick={{ fontSize: 11, fill: INK, opacity: 0.5 }}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
            />
            <Tooltip
              formatter={(value) => [formatValue(Number(value), format), title]}
              labelFormatter={(label) => String(label)}
              contentStyle={{
                borderRadius: 12,
                border: `1px solid ${INK}1a`,
                fontSize: 12,
              }}
            />
            {events
              .filter((event) => dates.has(event.date))
              .map((event) => (
                <ReferenceLine
                  key={`${event.date}-${event.label}`}
                  x={event.date}
                  stroke={INK}
                  strokeDasharray="4 3"
                  strokeOpacity={0.45}
                  label={{
                    value: event.label,
                    position: "insideTopLeft",
                    fontSize: 10,
                    fill: INK,
                    opacity: 0.7,
                  }}
                />
              ))}
            <Line
              type="monotone"
              dataKey="value"
              stroke={VIOLET}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
