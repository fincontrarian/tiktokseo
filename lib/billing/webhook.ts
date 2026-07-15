/**
 * Stripe event → subscriptions-table mirror. Pure functions, unit-testable
 * without the SDK: they accept plain event payloads (already signature-
 * verified by the route) and return the row to write, or null to ignore.
 */

import type { SubscriptionMirror } from "@/lib/data/billing";
import { TRIAL_DAYS } from "@/lib/plan";

const DAY_MS = 24 * 60 * 60 * 1000;

interface EventMetadata {
  userId?: string;
  plan?: string;
  interval?: string;
  from?: string;
}

/** The fields we read off a checkout.session.completed object. */
export interface CheckoutSessionPayload {
  subscription?: string | { id: string } | null;
  customer?: string | { id: string } | null;
  metadata?: EventMetadata | null;
}

/** The fields we read off a customer.subscription.* object. */
export interface SubscriptionPayload {
  id: string;
  customer?: string | { id: string } | null;
  status?: string;
  metadata?: EventMetadata | null;
  trial_end?: number | null;
  cancel_at_period_end?: boolean;
  /** Pre-2025 API versions: on the subscription. */
  current_period_end?: number | null;
  /** 2025+ API versions: on the items. */
  items?: { data?: Array<{ current_period_end?: number | null }> } | null;
}

function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

function dateOf(unixSeconds: number | null | undefined): Date | null {
  return unixSeconds ? new Date(unixSeconds * 1000) : null;
}

function isPaidPlan(plan: string | undefined): plan is "creator" | "pro" {
  return plan === "creator" || plan === "pro";
}

/**
 * checkout.session.completed → the initial mirror row. The session carries
 * our metadata (userId/plan/interval); the subscription object itself may
 * not have synced yet, so the trial window is derived from planConfig — the
 * follow-up customer.subscription.updated events keep it in sync with Stripe.
 */
export function mirrorFromCheckoutSession(
  session: CheckoutSessionPayload,
  now: Date = new Date(),
): SubscriptionMirror | null {
  const subscriptionId = idOf(session.subscription);
  const customerId = idOf(session.customer);
  const metadata = session.metadata ?? {};
  if (!subscriptionId || !customerId) return null;
  if (!metadata.userId || !isPaidPlan(metadata.plan)) return null;

  const interval = metadata.interval === "year" ? "year" : "month";
  const trialEnd = new Date(now.getTime() + TRIAL_DAYS * DAY_MS);
  const periodDays = interval === "year" ? 365 : 30;
  return {
    userId: metadata.userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    plan: metadata.plan,
    status: "trialing",
    interval,
    trialEnd,
    currentPeriodEnd: new Date(trialEnd.getTime() + periodDays * DAY_MS),
    cancelAtPeriodEnd: false,
  };
}

/**
 * customer.subscription.created/updated → refresh the mirror from the
 * subscription object itself. Requires our metadata (set at checkout via
 * subscription_data.metadata); foreign subscriptions are ignored.
 */
export function mirrorFromSubscription(
  subscription: SubscriptionPayload,
): SubscriptionMirror | null {
  const metadata = subscription.metadata ?? {};
  const customerId = idOf(subscription.customer);
  if (!subscription.id || !customerId) return null;
  if (!metadata.userId || !isPaidPlan(metadata.plan)) return null;

  const periodEnd =
    subscription.current_period_end ??
    subscription.items?.data?.[0]?.current_period_end ??
    null;

  return {
    userId: metadata.userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    plan: metadata.plan,
    status: subscription.status ?? "active",
    interval: metadata.interval === "year" ? "year" : "month",
    trialEnd: dateOf(subscription.trial_end),
    currentPeriodEnd: dateOf(periodEnd),
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
  };
}
