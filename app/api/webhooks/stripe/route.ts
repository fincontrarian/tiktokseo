import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripeClient } from "@/lib/billing/stripe";
import {
  mirrorFromCheckoutSession,
  mirrorFromSubscription,
} from "@/lib/billing/webhook";
import type {
  CheckoutSessionPayload,
  SubscriptionPayload,
} from "@/lib/billing/webhook";
import {
  markSubscriptionCanceled,
  upsertSubscription,
} from "@/lib/data/billing";
import { logGateEvent } from "@/lib/data/events";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook → subscriptions table. This is the only writer of billing
 * state (plus the explicit cancel action); getUserPlan() reads it. Always
 * verify the signature — the payload is untrusted until then.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "webhook secret not configured" },
      { status: 500 },
    );
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripeClient().webhooks.constructEventAsync(
      payload,
      signature,
      secret,
    );
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as CheckoutSessionPayload;
      const mirror = mirrorFromCheckoutSession(session);
      if (mirror) {
        await upsertSubscription(mirror);
        // Close the attribution loop: which gate converted.
        const from = session.metadata?.from;
        if (from) {
          await logGateEvent({
            userId: mirror.userId,
            gate: from,
            kind: "conversion",
            path: "/api/webhooks/stripe",
          });
        }
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const mirror = mirrorFromSubscription(
        event.data.object as unknown as SubscriptionPayload,
      );
      if (mirror) await upsertSubscription(mirror);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as { id?: string };
      if (subscription.id) await markSubscriptionCanceled(subscription.id);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
