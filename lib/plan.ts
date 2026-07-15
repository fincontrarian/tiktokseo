/**
 * Plan configuration — THE single source of truth for plan limits. Pure
 * TypeScript, no framework imports. UI, server actions, the recency gate,
 * and cron jobs all read limits from here; never scatter plan constants.
 */

export type Plan = "free" | "creator" | "pro";

export interface PlanPricing {
  /** Monthly price in cents. */
  monthlyCents: number;
  /** Annual price in cents (20% off twelve monthly payments). */
  annualCents: number;
  /** Free-trial length for this tier. */
  trialDays: number;
}

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
  /** How many keywords the user can add to rank tracking. */
  trackedKeywordLimit: number;
  /** Competitor compare (pro; ships as a stub first). */
  competitorCompare: boolean;
  /** null = the free tier (no checkout). */
  pricing: PlanPricing | null;
}

export const ANNUAL_DISCOUNT = 0.2;
export const TRIAL_DAYS = 7;

/** Annual = 12 monthly payments minus the discount, in whole cents. */
export function annualCents(monthlyCents: number): number {
  return Math.round(monthlyCents * 12 * (1 - ANNUAL_DISCOUNT));
}

export const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  free: {
    id: "free",
    trackedProfileLimit: 1,
    auditRerunsPerDay: 1,
    freshKeywordData: false,
    keywordRowCap: 3,
    csvExport: false,
    trackedKeywordLimit: 3,
    competitorCompare: false,
    pricing: null,
  },
  creator: {
    id: "creator",
    trackedProfileLimit: 1,
    auditRerunsPerDay: 6,
    freshKeywordData: true,
    keywordRowCap: null,
    csvExport: false,
    trackedKeywordLimit: 25,
    competitorCompare: false,
    pricing: {
      monthlyCents: 1200,
      annualCents: annualCents(1200),
      trialDays: TRIAL_DAYS,
    },
  },
  pro: {
    id: "pro",
    trackedProfileLimit: 5,
    auditRerunsPerDay: 24,
    freshKeywordData: true,
    keywordRowCap: null,
    csvExport: true,
    trackedKeywordLimit: 100,
    competitorCompare: true,
    pricing: {
      monthlyCents: 2900,
      annualCents: annualCents(2900),
      trialDays: TRIAL_DAYS,
    },
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
