"use client";

import { useActionState } from "react";
import type { EventFormState } from "@/app/[locale]/app/dashboard/actions";

interface EventFormProps {
  action: (prev: EventFormState, formData: FormData) => Promise<EventFormState>;
  creatorId: string;
  today: string; // YYYY-MM-DD
  labels: {
    date: string;
    label: string;
    labelPlaceholder: string;
    note: string;
    cta: string;
    invalid: string;
    success: string;
  };
}

export function EventForm({
  action,
  creatorId,
  today,
  labels,
}: EventFormProps) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle" as const,
  });

  return (
    <form
      action={formAction}
      data-testid="event-form"
      className="border-ink/10 flex flex-wrap items-end gap-3 rounded-2xl border p-4"
    >
      <input type="hidden" name="creatorId" value={creatorId} />
      <label className="text-ink/60 flex flex-col gap-1 text-xs font-medium">
        {labels.date}
        <input
          name="date"
          type="date"
          required
          defaultValue={today}
          max={today}
          className="border-ink/20 text-ink h-10 rounded-xl border px-3 text-sm"
        />
      </label>
      <label className="text-ink/60 flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium">
        {labels.label}
        <input
          name="label"
          type="text"
          required
          maxLength={80}
          placeholder={labels.labelPlaceholder}
          data-testid="event-label-input"
          className="border-ink/20 text-ink h-10 rounded-xl border px-3 text-sm"
        />
      </label>
      <label className="text-ink/60 flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium">
        {labels.note}
        <input
          name="note"
          type="text"
          maxLength={500}
          className="border-ink/20 text-ink h-10 rounded-xl border px-3 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        data-testid="event-submit"
        className="bg-ink hover:bg-ink/85 h-10 rounded-full px-5 text-sm font-semibold text-white transition disabled:opacity-60"
      >
        {labels.cta}
      </button>
      {state.status === "invalid" && (
        <p role="alert" className="w-full text-sm text-red-600">
          {labels.invalid}
        </p>
      )}
      {state.status === "success" && (
        <p data-testid="event-success" className="text-violet w-full text-sm">
          {labels.success}
        </p>
      )}
    </form>
  );
}
