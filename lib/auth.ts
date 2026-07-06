import { cookies } from "next/headers";
import type { Plan } from "@/lib/keywords/gate";

/**
 * AUTH PLACEHOLDER — real authentication ships in a later prompt.
 * Every request gets a fixed dev user; the plan comes from a dev cookie so
 * both tiers can be exercised. Replace getSession() wholesale when real
 * auth lands; callers only depend on the Session shape.
 */

export const PLAN_COOKIE = "fd_plan";

export interface Session {
  userId: string;
  plan: Plan;
}

export async function getSession(): Promise<Session> {
  const jar = await cookies();
  const plan: Plan = jar.get(PLAN_COOKIE)?.value === "paid" ? "paid" : "free";
  return { userId: "dev-user-1", plan };
}
