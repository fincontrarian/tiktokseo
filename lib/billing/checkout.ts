import type Stripe from "stripe";
import { stripeClient } from "@/lib/billing/stripe";
import { planConfig } from "@/lib/plan";
import type { Plan } from "@/lib/plan";

/**
 * Checkout session creation. Prices come from planConfig (the single source
 * of truth) as inline price_data — no dashboard-managed price IDs to drift.
 */

export type BillingInterval = "month" | "year";

export function normalizeInterval(raw: unknown): BillingInterval {
  return raw === "year" ? "year" : "month";
}

export function normalizePaidPlan(
  raw: unknown,
): Extract<Plan, "creator" | "pro"> | null {
  return raw === "creator" || raw === "pro" ? raw : null;
}

const BASE = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export interface CheckoutInput {
  userId: string;
  email: string;
  plan: "creator" | "pro";
  interval: BillingInterval;
  /** Which upgrade gate sent the user here (/pricing?from=...). */
  from?: string;
  /** Reuse the customer from a previous subscription, if any. */
  stripeCustomerId?: string | null;
}

export async function createCheckoutSession(
  input: CheckoutInput,
): Promise<Stripe.Checkout.Session> {
  const pricing = planConfig(input.plan).pricing;
  if (!pricing) throw new Error(`Plan ${input.plan} is not purchasable`);

  const unitAmount =
    input.interval === "year" ? pricing.annualCents : pricing.monthlyCents;
  const metadata = {
    userId: input.userId,
    plan: input.plan,
    interval: input.interval,
    from: input.from ?? "",
  };

  const stripe = stripeClient();
  return stripe.checkout.sessions.create({
    mode: "subscription",
    ...(input.stripeCustomerId
      ? { customer: input.stripeCustomerId }
      : { customer_email: input.email }),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: unitAmount,
          recurring: { interval: input.interval },
          product_data: {
            name: `Findable ${input.plan === "pro" ? "Pro" : "Creator"}`,
          },
        },
      },
    ],
    subscription_data: {
      trial_period_days: pricing.trialDays,
      metadata,
    },
    metadata,
    success_url: `${BASE}/app/dashboard?upgraded=1`,
    cancel_url: `${BASE}/pricing?checkout=canceled`,
  });
}
