"use client";

import { useActionState } from "react";
import type { RerunAuditState } from "@/app/[locale]/app/dashboard/actions";

interface RerunAuditButtonProps {
  action: (
    prev: RerunAuditState,
    formData: FormData,
  ) => Promise<RerunAuditState>;
  creatorId: string;
  handle: string;
  cta: string;
  messages: {
    limited: string;
    success: string;
    error: string;
  };
}

export function RerunAuditButton({
  action,
  creatorId,
  handle,
  cta,
  messages,
}: RerunAuditButtonProps) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle" as const,
  });

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="creatorId" value={creatorId} />
      <input type="hidden" name="handle" value={handle} />
      <button
        type="submit"
        disabled={pending}
        data-testid="rerun-audit"
        className="border-ink/20 hover:border-violet hover:text-violet rounded-full border px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
      >
        {cta}
      </button>
      {state.status === "limited" && (
        <p data-testid="rerun-limited" className="text-sm text-amber-700">
          {messages.limited}
        </p>
      )}
      {state.status === "success" && (
        <p data-testid="rerun-success" className="text-violet text-sm">
          {messages.success}
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          {messages.error}
        </p>
      )}
    </form>
  );
}
