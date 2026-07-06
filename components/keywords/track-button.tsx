"use client";

import { useActionState } from "react";
import type { TrackState } from "@/app/[locale]/app/keywords/actions";

interface TrackButtonProps {
  action: (prev: TrackState, formData: FormData) => Promise<TrackState>;
  keywordId: string;
  label: string;
  trackedLabel: string;
  initialTracked: boolean;
}

export function TrackButton({
  action,
  keywordId,
  label,
  trackedLabel,
  initialTracked,
}: TrackButtonProps) {
  const [state, formAction, pending] = useActionState(action, {
    tracked: initialTracked,
  });

  if (state.tracked) {
    return (
      <span
        data-testid="tracked-badge"
        className="text-violet text-xs font-semibold whitespace-nowrap"
      >
        {trackedLabel}
      </span>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="keywordId" value={keywordId} />
      <button
        type="submit"
        disabled={pending}
        data-testid="track-button"
        className="border-ink/20 hover:border-violet hover:text-violet rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap transition disabled:opacity-50"
      >
        {label}
      </button>
    </form>
  );
}
