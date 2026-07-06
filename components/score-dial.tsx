import type { CSSProperties } from "react";
import type { Grade } from "@/lib/scoring";

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface ScoreDialProps {
  score: number;
  grade: Grade;
  scoreLabel: string;
  gradeLabel: string;
}

/**
 * Animated score dial. Pure SVG + CSS (see globals.css), so it renders on
 * the server and animates on load without any client JS.
 */
export function ScoreDial({
  score,
  grade,
  scoreLabel,
  gradeLabel,
}: ScoreDialProps) {
  const target = CIRCUMFERENCE * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-48 w-48">
        <svg viewBox="0 0 140 140" className="h-full w-full">
          <circle
            cx="70"
            cy="70"
            r={RADIUS}
            fill="none"
            strokeWidth="12"
            className="stroke-ink/10"
          />
          <circle
            cx="70"
            cy="70"
            r={RADIUS}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            transform="rotate(-90 70 70)"
            className="dial-arc stroke-violet"
            style={
              {
                "--dial-circumference": CIRCUMFERENCE,
                "--dial-target": target,
              } as CSSProperties
            }
          />
        </svg>
        <div className="dial-score absolute inset-0 flex flex-col items-center justify-center">
          <span data-testid="score-value" className="text-5xl font-bold">
            {score}
          </span>
          <span className="text-ink/50 text-sm">/100</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-ink/60 text-sm font-medium">{scoreLabel}</span>
        <span
          data-testid="score-grade"
          aria-label={gradeLabel}
          className="bg-lime text-ink rounded-full px-3 py-1 text-sm font-bold"
        >
          {grade}
        </span>
      </div>
    </div>
  );
}
