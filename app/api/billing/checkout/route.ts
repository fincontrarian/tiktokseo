import { NextResponse } from "next/server";
import {
  createCheckoutSession,
  normalizeInterval,
  normalizePaidPlan,
} from "@/lib/billing/checkout";
import { getSession } from "@/lib/auth";
import { getStripeCustomerId } from "@/lib/data/billing";

export const dynamic = "force-dynamic";

const BASE = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/** Only same-site gate slugs ride along as attribution. */
function safeFrom(raw: FormDataEntryValue | null): string | undefined {
  const value = String(raw ?? "");
  return /^[a-z0-9-]{1,64}$/.test(value) ? value : undefined;
}

/**
 * Starts a Stripe Checkout for a paid tier. Signed-out users are sent to
 * /signin first and come back here via callbackUrl.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const plan = normalizePaidPlan(form.get("plan"));
  const interval = normalizeInterval(form.get("interval"));
  const from = safeFrom(form.get("from"));
  if (!plan) {
    return NextResponse.json({ error: "invalid plan" }, { status: 400 });
  }

  const session = await getSession();
  if (!session) {
    const back = new URLSearchParams({
      callbackUrl: `/pricing${from ? `?from=${from}` : ""}`,
    });
    return NextResponse.redirect(`${BASE}/signin?${back}`, 303);
  }

  const checkout = await createCheckoutSession({
    userId: session.userId,
    email: session.email,
    plan,
    interval,
    from,
    stripeCustomerId: await getStripeCustomerId(session.userId),
  });

  // Against stripe-mock the hosted page can't be completed, so dev/E2E hop
  // to the completion simulator, which fires the same signed webhook Stripe
  // would send. Production always follows checkout.url.
  const simulateCompletion =
    process.env.STRIPE_API_BASE &&
    (process.env.NODE_ENV !== "production" ||
      process.env.E2E_TEST_MODE === "1");
  if (simulateCompletion) {
    const params = new URLSearchParams({
      session_id: checkout.id,
      plan,
      interval,
      ...(from ? { from } : {}),
    });
    return NextResponse.redirect(
      `${BASE}/api/dev/complete-checkout?${params}`,
      303,
    );
  }

  if (!checkout.url) {
    return NextResponse.json({ error: "no checkout url" }, { status: 502 });
  }
  return NextResponse.redirect(checkout.url, 303);
}
