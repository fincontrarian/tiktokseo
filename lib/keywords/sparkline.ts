/**
 * Build an SVG polyline points string from a numeric series, normalized to
 * the given viewBox. Pure and deterministic.
 */
export function sparklinePoints(
  values: number[],
  width = 96,
  height = 28,
  padding = 2,
): string {
  const series = values.filter((v) => Number.isFinite(v));
  if (series.length === 0) return "";

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const step = series.length > 1 ? innerW / (series.length - 1) : 0;

  return series
    .map((value, i) => {
      const x = padding + (series.length > 1 ? i * step : innerW / 2);
      const y = padding + innerH - ((value - min) / span) * innerH;
      return `${round2(x)},${round2(y)}`;
    })
    .join(" ");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
