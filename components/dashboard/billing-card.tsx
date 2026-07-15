"use client";

import { useActionState } from "react";
import type { CancelSubscriptionState } from "@/app/[locale]/app/dashboard/actions";

interface BillingCardProps {
  action: (
    prev: CancelSubscriptionState,
    formData: FormData,
  ) => Promise<CancelSubscriptionState>;
  planLabel: string;
  statusText: string;
  labels: {
    title: string;
    currentPlan: string;
    cancel: string;
  };
}

/**
 * Current-plan card with cancel — shown only while a subscription is live.
 * Cancel redirects to ?canceled=1; the page renders the confirmation.
 */
export function BillingCard({
  action,
  planLabel,
  statusText,
  labels,
}: BillingCardProps) {
  const [, formAction, pending] = useActionState<
    CancelSubscriptionState,
    FormData
  >(action, { status: "idle" });

  return (
    <section
      data-testid="billing-card"
      className="border-ink/10 mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5"
    >
      <div>
        <p className="text-ink/50 text-xs font-medium uppercase">
          {labels.title}
        </p>
        <p className="mt-1 text-sm">
          <span className="font-semibold">{labels.currentPlan}:</span>{" "}
          <span data-testid="billing-plan">{planLabel}</span>
          <span className="text-ink/50 ml-2" data-testid="billing-status">
            {statusText}
          </span>
        </p>
      </div>
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          data-testid="cancel-subscription"
          className="border-ink/20 rounded-full border px-4 py-2 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
        >
          {labels.cancel}
        </button>
      </form>
    </section>
  );
}
