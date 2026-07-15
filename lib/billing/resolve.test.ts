import { describe, expect, it } from "vitest";
import {
  ENTITLED_STATUSES,
  resolveSubscriptionPlan,
  resolveUserPlan,
} from "./resolve";
import type { SubscriptionLike } from "./resolve";

const NOW = new Date("2026-07-07T12:00:00Z");

function sub(overrides: Partial<SubscriptionLike> = {}): SubscriptionLike {
  return {
    plan: "creator",
    status: "active",
    currentPeriodEnd: new Date("2026-08-01T00:00:00Z"),
    trialEnd: null,
    ...overrides,
  };
}

describe("resolveSubscriptionPlan", () => {
  it("grants the plan for active subscriptions", () => {
    expect(resolveSubscriptionPlan(sub(), NOW)).toBe("creator");
    expect(resolveSubscriptionPlan(sub({ plan: "pro" }), NOW)).toBe("pro");
  });

  it("grants access during the 7-day trial", () => {
    expect(
      resolveSubscriptionPlan(
        sub({
          status: "trialing",
          trialEnd: new Date("2026-07-14T00:00:00Z"),
        }),
        NOW,
      ),
    ).toBe("creator");
  });

  it("keeps access during dunning (past_due) but not after cancellation", () => {
    expect(resolveSubscriptionPlan(sub({ status: "past_due" }), NOW)).toBe(
      "creator",
    );
    for (const status of ["canceled", "unpaid", "incomplete", "paused"]) {
      expect(resolveSubscriptionPlan(sub({ status }), NOW)).toBe("free");
    }
  });

  it("returns free for missing rows", () => {
    expect(resolveSubscriptionPlan(null, NOW)).toBe("free");
    expect(resolveSubscriptionPlan(undefined, NOW)).toBe("free");
  });

  it("expires stale rows whose period ended >24h ago (missed webhook)", () => {
    const stale = sub({
      currentPeriodEnd: new Date("2026-07-01T00:00:00Z"),
    });
    expect(resolveSubscriptionPlan(stale, NOW)).toBe("free");

    // Within the grace window access holds (renewal webhook may be in flight).
    const justEnded = sub({
      currentPeriodEnd: new Date("2026-07-07T02:00:00Z"),
    });
    expect(resolveSubscriptionPlan(justEnded, NOW)).toBe("creator");

    // No period end recorded → status alone governs.
    expect(resolveSubscriptionPlan(sub({ currentPeriodEnd: null }), NOW)).toBe(
      "creator",
    );
  });

  it("never grants an unknown plan string", () => {
    expect(resolveSubscriptionPlan(sub({ plan: "enterprise" }), NOW)).toBe(
      "free",
    );
    expect(resolveSubscriptionPlan(sub({ plan: "" }), NOW)).toBe("free");
  });

  it("documents exactly which statuses are entitled", () => {
    expect([...ENTITLED_STATUSES].sort()).toEqual([
      "active",
      "past_due",
      "trialing",
    ]);
  });
});

describe("resolveUserPlan", () => {
  it("returns free with no subscriptions", () => {
    expect(resolveUserPlan([], NOW)).toBe("free");
  });

  it("picks the best live plan across rows", () => {
    expect(
      resolveUserPlan(
        [sub({ status: "canceled" }), sub({ plan: "pro" }), sub()],
        NOW,
      ),
    ).toBe("pro");
    expect(
      resolveUserPlan([sub({ plan: "pro", status: "canceled" }), sub()], NOW),
    ).toBe("creator");
  });

  it("a canceled pro grants nothing — limits are restored", () => {
    expect(
      resolveUserPlan([sub({ plan: "pro", status: "canceled" })], NOW),
    ).toBe("free");
  });
});
