"use client";

import { PLANS } from "@/lib/plan";
import type { Plan } from "@/lib/plan";

interface PlanSwitcherProps {
  action: (formData: FormData) => Promise<void>;
  current: Plan;
  label: string;
  planLabels: Record<Plan, string>;
}

/** DEV ONLY — plan simulator until real auth/billing ships. */
export function PlanSwitcher({
  action,
  current,
  label,
  planLabels,
}: PlanSwitcherProps) {
  return (
    <form
      action={action}
      className="border-ink/15 flex items-center gap-1 rounded-full border p-0.5 text-xs"
      title={label}
    >
      {PLANS.map((plan) => (
        <button
          key={plan}
          type="submit"
          name="plan"
          value={plan}
          data-testid={`plan-${plan}`}
          className={
            plan === current
              ? "bg-ink rounded-full px-3 py-1 font-semibold text-white"
              : "text-ink/60 hover:text-ink px-3 py-1"
          }
        >
          {planLabels[plan]}
        </button>
      ))}
    </form>
  );
}
