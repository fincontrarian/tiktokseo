"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { setDevSubscription } from "@/lib/data/billing";
import { normalizePlan } from "@/lib/plan";

/** True outside production, or when E2E explicitly enables test hooks. */
export async function devToolsEnabled(): Promise<boolean> {
  return (
    process.env.NODE_ENV !== "production" || process.env.E2E_TEST_MODE === "1"
  );
}

/**
 * DEV/E2E ONLY — simulate a plan by writing a real subscription row for the
 * signed-in user, so getUserPlan stays the single source of truth even in
 * tests. No-op in production.
 */
export async function setDevPlanAction(formData: FormData): Promise<void> {
  if (!(await devToolsEnabled())) return;
  const session = await requireSession();
  const plan = normalizePlan(String(formData.get("plan") ?? ""));
  await setDevSubscription(session.userId, plan);
  revalidatePath("/", "layout");
}
