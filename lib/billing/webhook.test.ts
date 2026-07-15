import { describe, expect, it } from "vitest";
import { mirrorFromCheckoutSession, mirrorFromSubscription } from "./webhook";

const NOW = new Date("2026-07-07T00:00:00Z");

describe("mirrorFromCheckoutSession", () => {
  const session = {
    subscription: "sub_123",
    customer: "cus_123",
    metadata: { userId: "user_1", plan: "creator", interval: "month" },
  };

  it("creates a trialing mirror with the 7-day window from planConfig", () => {
    const mirror = mirrorFromCheckoutSession(session, NOW);
    expect(mirror).toMatchObject({
      userId: "user_1",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      plan: "creator",
      status: "trialing",
      interval: "month",
      cancelAtPeriodEnd: false,
    });
    expect(mirror!.trialEnd!.toISOString()).toBe("2026-07-14T00:00:00.000Z");
    expect(mirror!.currentPeriodEnd!.getTime()).toBeGreaterThan(
      mirror!.trialEnd!.getTime(),
    );
  });

  it("handles expanded object references and annual interval", () => {
    const mirror = mirrorFromCheckoutSession(
      {
        subscription: { id: "sub_9" },
        customer: { id: "cus_9" },
        metadata: { userId: "u", plan: "pro", interval: "year" },
      },
      NOW,
    );
    expect(mirror).toMatchObject({
      stripeSubscriptionId: "sub_9",
      stripeCustomerId: "cus_9",
      plan: "pro",
      interval: "year",
    });
  });

  it("ignores sessions without our metadata or without ids", () => {
    expect(mirrorFromCheckoutSession({ ...session, metadata: {} }, NOW)).toBe(
      null,
    );
    expect(
      mirrorFromCheckoutSession(
        { ...session, metadata: { userId: "u", plan: "enterprise" } },
        NOW,
      ),
    ).toBeNull();
    expect(
      mirrorFromCheckoutSession({ ...session, subscription: null }, NOW),
    ).toBeNull();
    expect(
      mirrorFromCheckoutSession({ ...session, customer: null }, NOW),
    ).toBeNull();
  });
});

describe("mirrorFromSubscription", () => {
  const subscription = {
    id: "sub_123",
    customer: "cus_123",
    status: "active",
    metadata: { userId: "user_1", plan: "pro", interval: "month" },
    trial_end: 1_783_468_800, // 2026-07-08
    cancel_at_period_end: true,
    current_period_end: 1_785_542_400, // 2026-08-01
  };

  it("mirrors status, period end, trial end, and cancel flag", () => {
    const mirror = mirrorFromSubscription(subscription);
    expect(mirror).toMatchObject({
      userId: "user_1",
      plan: "pro",
      status: "active",
      cancelAtPeriodEnd: true,
    });
    expect(mirror!.currentPeriodEnd!.toISOString()).toBe(
      "2026-08-01T00:00:00.000Z",
    );
    expect(mirror!.trialEnd).not.toBeNull();
  });

  it("reads current_period_end from items on 2025+ API shapes", () => {
    const mirror = mirrorFromSubscription({
      ...subscription,
      current_period_end: null,
      items: { data: [{ current_period_end: 1_785_542_400 }] },
    });
    expect(mirror!.currentPeriodEnd!.toISOString()).toBe(
      "2026-08-01T00:00:00.000Z",
    );
  });

  it("ignores foreign subscriptions without our metadata", () => {
    expect(
      mirrorFromSubscription({ ...subscription, metadata: {} }),
    ).toBeNull();
    expect(
      mirrorFromSubscription({ ...subscription, customer: null }),
    ).toBeNull();
  });
});
