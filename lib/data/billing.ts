import { resolveUserPlan } from "@/lib/billing/resolve";
import { prisma } from "@/lib/db";
import type { Plan } from "@/lib/plan";

/**
 * Billing repository. The subscriptions table is a mirror of Stripe,
 * maintained by the webhook handler; getUserPlan() is THE entitlement
 * resolver — withRecencyGate, dashboard limits, audit reruns, and the
 * export route all go through it.
 */

/** The one place a user's effective plan is decided. */
export async function getUserPlan(userId: string): Promise<Plan> {
  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
    select: {
      plan: true,
      status: true,
      currentPeriodEnd: true,
      trialEnd: true,
    },
  });
  return resolveUserPlan(subscriptions);
}

export interface SubscriptionMirror {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: string;
  status: string;
  interval: string;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

/** Webhook writes land here — idempotent per Stripe subscription id. */
export async function upsertSubscription(
  mirror: SubscriptionMirror,
): Promise<void> {
  const { stripeSubscriptionId, ...rest } = mirror;
  await prisma.subscription.upsert({
    where: { stripeSubscriptionId },
    create: { stripeSubscriptionId, ...rest },
    update: rest,
  });
}

/** Mark a subscription canceled (customer.subscription.deleted). */
export async function markSubscriptionCanceled(
  stripeSubscriptionId: string,
): Promise<void> {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId },
    data: { status: "canceled", cancelAtPeriodEnd: false },
  });
}

export interface ActiveSubscription {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  plan: string;
  status: string;
  interval: string;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

/** The user's live subscription, if any (for the billing card / cancel). */
export async function getActiveSubscription(
  userId: string,
): Promise<ActiveSubscription | null> {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: { in: ["active", "trialing", "past_due"] } },
    orderBy: { updatedAt: "desc" },
    select: {
      stripeSubscriptionId: true,
      stripeCustomerId: true,
      plan: true,
      status: true,
      interval: true,
      trialEnd: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });
  return subscription;
}

/**
 * DEV/E2E ONLY — simulate a plan by writing a real subscription row, so the
 * whole entitlement path (getUserPlan → gates) is exercised, never bypassed.
 * Guarded by the caller; never reachable in production.
 */
export async function setDevSubscription(
  userId: string,
  plan: Plan,
): Promise<void> {
  const devId = `dev_${userId}`;
  if (plan === "free") {
    await prisma.subscription.deleteMany({
      where: { userId, stripeSubscriptionId: devId },
    });
    // Real (non-dev) rows keep their status; the simulator only clears its own.
    await prisma.subscription.updateMany({
      where: { userId, stripeSubscriptionId: { not: devId } },
      data: { status: "canceled" },
    });
    return;
  }
  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: devId },
    create: {
      userId,
      stripeCustomerId: `dev_cus_${userId}`,
      stripeSubscriptionId: devId,
      plan,
      status: "active",
      interval: "month",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    update: {
      plan,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
}

/** Latest Stripe customer id we've seen for this user, to reuse at checkout. */
export async function getStripeCustomerId(
  userId: string,
): Promise<string | null> {
  const subscription = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { stripeCustomerId: true },
  });
  return subscription?.stripeCustomerId ?? null;
}
