import { sparklinePoints } from "@/lib/keywords/sparkline";

const WIDTH = 96;
const HEIGHT = 28;

/** Tiny server-rendered trend chart for a daily series. */
export function Sparkline({ values }: { values: number[] }) {
  const points = sparklinePoints(values, WIDTH, HEIGHT);
  if (!points) {
    return <span className="text-ink/30 text-xs">—</span>;
  }
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-7 w-24"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-violet"
      />
    </svg>
  );
}
