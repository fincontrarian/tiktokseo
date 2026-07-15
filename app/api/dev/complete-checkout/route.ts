import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { stripeClient } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

const BASE = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/**
 * DEV/E2E ONLY — stands in for Stripe's hosted checkout page, which cannot
 * be completed against stripe-mock. Builds the checkout.session.completed
 * event Stripe would send, signs it with the real webhook secret, and POSTs
 * it to our webhook — so signature verification, the mirror write, and
 * getUserPlan() are exercised exactly as in production. 404s in production.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" && !process.env.E2E_TEST_MODE) {
    return new Response("Not found", { status: 404 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "sign in first" }, { status: 401 });
  }

  const url = new URL(request.url);
  const plan = url.searchParams.get("plan");
  const interval =
    url.searchParams.get("interval") === "year" ? "year" : "month";
  const from = url.searchParams.get("from") ?? "";
  const sessionId =
    url.searchParams.get("session_id") ?? `cs_dev_${Date.now()}`;
  if (plan !== "creator" && plan !== "pro") {
    return NextResponse.json({ error: "invalid plan" }, { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "no webhook secret" }, { status: 500 });
  }

  const suffix = Math.random().toString(36).slice(2, 10);
  const event = {
    id: `evt_dev_${suffix}`,
    object: "event",
    type: "checkout.session.completed",
    api_version: "2025-01-01",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        mode: "subscription",
        subscription: `sub_dev_${session.userId}_${suffix}`,
        customer: `cus_dev_${session.userId}`,
        metadata: { userId: session.userId, plan, interval, from },
      },
    },
  };

  const payload = JSON.stringify(event);
  const signature = await stripeClient().webhooks.generateTestHeaderStringAsync(
    { payload, secret },
  );
  const response = await fetch(`${BASE}/api/webhooks/stripe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });
  if (!response.ok) {
    return NextResponse.json(
      { error: "webhook delivery failed", status: response.status },
      { status: 502 },
    );
  }

  return NextResponse.redirect(`${BASE}/app/dashboard?upgraded=1`, 303);
}
