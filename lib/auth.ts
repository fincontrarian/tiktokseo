import { cookies } from "next/headers";
import { normalizePlan } from "@/lib/plan";
import type { Plan } from "@/lib/plan";

/**
 * AUTH PLACEHOLDER — real authentication ships in a later prompt.
 * Every request gets a fixed dev user; the plan comes from a dev cookie so
 * all tiers can be exercised. Replace getSession() wholesale when real
 * auth lands; callers only depend on the Session shape.
 */

export const PLAN_COOKIE = "fd_plan";

export interface Session {
  userId: string;
  plan: Plan;
}

export async function getSession(): Promise<Session> {
  const jar = await cookies();
  return {
    userId: "dev-user-1",
    plan: normalizePlan(jar.get(PLAN_COOKIE)?.value),
  };
}
