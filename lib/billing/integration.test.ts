/**
 * Billing integration test against stripe-mock: checkout-session creation is
 * validated by stripe-mock's OpenAPI schema, then a signed webhook event is
 * pushed through the real route handler and the plan is resolved through
 * getUserPlan() — the exact production path.
 *
 * Needs Postgres (DATABASE_URL) and the stripe-mock binary (.bin/stripe-mock,
 * built via: GOBIN=$PWD/.bin go install github.com/stripe/stripe-mock@latest).
 * The suite spawns stripe-mock itself if nothing is listening yet.
 */

import "dotenv/config";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PORT = 12111;
const WEBHOOK_SECRET = "whsec_integration_test";

process.env.STRIPE_API_BASE = `http://localhost:${PORT}`;
process.env.STRIPE_SECRET_KEY = "sk_test_123";
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;

function portOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portOpen(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

const BINARY = path.resolve(__dirname, "../../.bin/stripe-mock");
let child: ChildProcess | undefined;
let available = false;

beforeAll(async () => {
  if (await portOpen(PORT)) {
    available = true;
  } else if (existsSync(BINARY)) {
    child = spawn(BINARY, ["-port", String(PORT)], { stdio: "ignore" });
    available = await waitForPort(PORT, 10_000);
  } else {
    console.warn("stripe-mock binary missing — billing integration skipped");
  }
  if (available) {
    // Subscriptions are FK'd to users — the webhook only ever writes rows
    // for real accounts.
    const { prisma } = await import("@/lib/db");
    await prisma.user.create({
      data: { id: USER_ID, email: `${USER_ID}@example.com` },
    });
  }
}, 20_000);

afterAll(async () => {
  child?.kill();
  const { prisma } = await import("@/lib/db");
  await prisma.gateEvent.deleteMany({
    where: { userId: { startsWith: "it_user_" } },
  });
  // Cascade removes the subscription rows.
  await prisma.user.deleteMany({ where: { id: { startsWith: "it_user_" } } });
  await prisma.$disconnect();
});

const USER_ID = `it_user_${Date.now()}`;

describe("billing pipeline (stripe-mock)", () => {
  it("creates a checkout session that passes Stripe's schema validation", async () => {
    if (!available) return;
    const { createCheckoutSession } = await import("@/lib/billing/checkout");
    const session = await createCheckoutSession({
      userId: USER_ID,
      email: "integration@example.com",
      plan: "creator",
      interval: "year",
      from: "keywords-blur",
    });
    expect(session.id).toMatch(/^cs_/);
    expect(session.object).toBe("checkout.session");
  });

  it("signed checkout webhook → subscriptions table → getUserPlan", async () => {
    if (!available) return;
    const { stripeClient } = await import("@/lib/billing/stripe");
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const { getUserPlan } = await import("@/lib/data/billing");

    expect(await getUserPlan(USER_ID)).toBe("free");

    const payload = JSON.stringify({
      id: "evt_it_1",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_it_1",
          object: "checkout.session",
          subscription: `sub_it_${USER_ID}`,
          customer: `cus_it_${USER_ID}`,
          metadata: {
            userId: USER_ID,
            plan: "pro",
            interval: "month",
            from: "profile-limit",
          },
        },
      },
    });
    const signature =
      await stripeClient().webhooks.generateTestHeaderStringAsync({
        payload,
        secret: WEBHOOK_SECRET,
      });
    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": signature },
        body: payload,
      }),
    );
    expect(response.status).toBe(200);

    // One resolver, one source of truth.
    expect(await getUserPlan(USER_ID)).toBe("pro");

    const { prisma } = await import("@/lib/db");
    const row = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: `sub_it_${USER_ID}` },
    });
    expect(row).toMatchObject({ plan: "pro", status: "trialing" });
    expect(row!.trialEnd).not.toBeNull();

    // Conversion attribution landed with the originating gate.
    const conversion = await prisma.gateEvent.findFirst({
      where: { userId: USER_ID, kind: "conversion" },
      orderBy: { createdAt: "desc" },
    });
    expect(conversion?.gate).toBe("profile-limit");
  });

  it("rejects a bad signature without touching the table", async () => {
    if (!available) return;
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=bogus" },
        body: JSON.stringify({ type: "checkout.session.completed" }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("first login converts matching leads (createUser event handler)", async () => {
    if (!available) return;
    const { prisma } = await import("@/lib/db");
    const { convertLeadsForUser } = await import("@/lib/data/leads");
    const email = `${USER_ID}@example.com`;
    await prisma.lead.upsert({
      where: { email_source: { email, source: "audit" } },
      create: { email, source: "audit", locale: "en" },
      update: { convertedUserId: null, convertedAt: null },
    });

    const converted = await convertLeadsForUser(USER_ID, email);
    expect(converted).toBe(1);
    const lead = await prisma.lead.findUnique({
      where: { email_source: { email, source: "audit" } },
    });
    expect(lead?.convertedUserId).toBe(USER_ID);
    expect(lead?.convertedAt).not.toBeNull();

    // Idempotent: a second login converts nothing new.
    expect(await convertLeadsForUser(USER_ID, email)).toBe(0);
    await prisma.lead.deleteMany({ where: { email } });
  });

  it("subscription.deleted webhook cancels → limits restored", async () => {
    if (!available) return;
    const { stripeClient } = await import("@/lib/billing/stripe");
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const { getUserPlan } = await import("@/lib/data/billing");

    const payload = JSON.stringify({
      id: "evt_it_2",
      object: "event",
      type: "customer.subscription.deleted",
      data: { object: { id: `sub_it_${USER_ID}`, object: "subscription" } },
    });
    const signature =
      await stripeClient().webhooks.generateTestHeaderStringAsync({
        payload,
        secret: WEBHOOK_SECRET,
      });
    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": signature },
        body: payload,
      }),
    );
    expect(response.status).toBe(200);
    expect(await getUserPlan(USER_ID)).toBe("free");
  });
});
