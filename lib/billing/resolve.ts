/**
 * Subscription → plan resolution. Pure TypeScript, no framework imports.
 *
 * The webhook handler mirrors Stripe subscriptions into the subscriptions
 * table; this module decides what plan a subscription row actually grants.
 * getUserPlan() (lib/data/billing.ts) is the only caller — everything else
 * (withRecencyGate, dashboard limits, audit reruns) asks getUserPlan().
 */

import { normalizePlan } from "@/lib/plan";
import type { Plan } from "@/lib/plan";

/** The subset of a subscriptions-table row that resolution needs. */
export interface SubscriptionLike {
  plan: string;
  status: string;
  currentPeriodEnd: Date | null;
  trialEnd: Date | null;
}

/**
 * Stripe statuses that grant access. `trialing` is the 7-day trial;
 * `past_due` keeps access during the dunning window (Stripe retries the
 * charge) — access drops when Stripe transitions it to `canceled` or
 * `unpaid` and the webhook mirrors that.
 */
export const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

/** Grace period after currentPeriodEnd before access lapses without a webhook. */
const PERIOD_END_GRACE_MS = 24 * 60 * 60 * 1000;

/** What plan does one subscription row grant right now? */
export function resolveSubscriptionPlan(
  subscription: SubscriptionLike | null | undefined,
  now: Date = new Date(),
): Plan {
  if (!subscription) return "free";
  if (!ENTITLED_STATUSES.has(subscription.status)) return "free";

  // Defense in depth: a stale row whose period ended long ago grants
  // nothing even if a cancellation webhook never arrived.
  if (
    subscription.currentPeriodEnd &&
    now.getTime() >
      subscription.currentPeriodEnd.getTime() + PERIOD_END_GRACE_MS
  ) {
    return "free";
  }

  return normalizePlan(subscription.plan);
}

/**
 * A user can hold multiple rows over time (resubscribes, upgrades). The
 * effective plan is the best one any live row grants: pro > creator > free.
 */
export function resolveUserPlan(
  subscriptions: SubscriptionLike[],
  now: Date = new Date(),
): Plan {
  let best: Plan = "free";
  for (const subscription of subscriptions) {
    const plan = resolveSubscriptionPlan(subscription, now);
    if (plan === "pro") return "pro";
    if (plan === "creator") best = "creator";
  }
  return best;
}
