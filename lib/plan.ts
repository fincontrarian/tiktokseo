/**
 * Plan configuration — THE single source of truth for plan limits. Pure
 * TypeScript, no framework imports. UI, server actions, the recency gate,
 * and cron jobs all read limits from here; never scatter plan constants.
 */

export type Plan = "free" | "creator" | "pro";

export interface PlanConfig {
  id: Plan;
  /** How many profiles the user can track on the dashboard. */
  trackedProfileLimit: number;
  /** Audit re-runs per profile per day. */
  auditRerunsPerDay: number;
  /** Keyword research: fresh data vs 30-day-delayed. */
  freshKeywordData: boolean;
  /** Keyword research: visible row cap (null = pagination governs). */
  keywordRowCap: number | null;
  /** Keyword research: CSV export allowed. */
  csvExport: boolean;
}

export const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  free: {
    id: "free",
    trackedProfileLimit: 1,
    auditRerunsPerDay: 1,
    freshKeywordData: false,
    keywordRowCap: 3,
    csvExport: false,
  },
  creator: {
    id: "creator",
    trackedProfileLimit: 1,
    auditRerunsPerDay: 6,
    freshKeywordData: true,
    keywordRowCap: null,
    csvExport: true,
  },
  pro: {
    id: "pro",
    trackedProfileLimit: 5,
    auditRerunsPerDay: 24,
    freshKeywordData: true,
    keywordRowCap: null,
    csvExport: true,
  },
};

export const PLANS: Plan[] = ["free", "creator", "pro"];

export function planConfig(plan: Plan): PlanConfig {
  return PLAN_CONFIG[plan];
}

/** Coerce untrusted input (cookies, params) to a valid plan. */
export function normalizePlan(raw: string | null | undefined): Plan {
  return raw === "creator" || raw === "pro" ? raw : "free";
}
