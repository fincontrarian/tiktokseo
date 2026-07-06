"use client";

import type { Plan } from "@/lib/keywords/gate";

interface PlanSwitcherProps {
  action: (formData: FormData) => Promise<void>;
  current: Plan;
  label: string;
  freeLabel: string;
  paidLabel: string;
}

/** DEV ONLY — plan simulator until real auth/billing ships. */
export function PlanSwitcher({
  action,
  current,
  label,
  freeLabel,
  paidLabel,
}: PlanSwitcherProps) {
  return (
    <form
      action={action}
      className="border-ink/15 flex items-center gap-1 rounded-full border p-0.5 text-xs"
      title={label}
    >
      {(["free", "paid"] as const).map((plan) => (
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
          {plan === "free" ? freeLabel : paidLabel}
        </button>
      ))}
    </form>
  );
}
