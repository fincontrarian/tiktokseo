import { describe, expect, it } from "vitest";
import { composeDigest, percentChange, weekStartUtc } from "./digest";
import type { ProfileDigestInput } from "./digest";

function profile(
  overrides: Partial<ProfileDigestInput> = {},
): ProfileDigestInput {
  return {
    handle: "lanmoves",
    followers: { start: 40_000, end: 42_000 },
    avgViews: { start: 12_000, end: 13_200 },
    engagementRate: { start: 0.03, end: 0.028 },
    saveRate: { start: 0.005, end: 0.004 },
    latestAuditScore: 65,
    ...overrides,
  };
}

describe("percentChange", () => {
  it("computes signed fractional change", () => {
    expect(percentChange(100, 110)).toBeCloseTo(0.1);
    expect(percentChange(100, 90)).toBeCloseTo(-0.1);
    expect(percentChange(50, 50)).toBe(0);
  });

  it("returns null for zero or non-finite starts", () => {
    expect(percentChange(0, 10)).toBeNull();
    expect(percentChange(Number.NaN, 10)).toBeNull();
  });
});

describe("weekStartUtc", () => {
  it("returns the Monday of the current week at midnight UTC", () => {
    // 2026-07-07 is a Tuesday -> Monday 2026-07-06
    expect(weekStartUtc(new Date("2026-07-07T15:00:00Z")).toISOString()).toBe(
      "2026-07-06T00:00:00.000Z",
    );
    // A Monday maps to itself
    expect(weekStartUtc(new Date("2026-07-06T01:00:00Z")).toISOString()).toBe(
      "2026-07-06T00:00:00.000Z",
    );
    // A Sunday maps back to the previous Monday
    expect(weekStartUtc(new Date("2026-07-12T23:00:00Z")).toISOString()).toBe(
      "2026-07-06T00:00:00.000Z",
    );
  });
});

describe("composeDigest", () => {
  const WEEK = new Date("2026-07-06T00:00:00Z");

  it("composes a subject and per-profile delta sections", () => {
    const digest = composeDigest([profile()], WEEK);
    expect(digest.subject).toBe("Your week on TikTok search: @lanmoves");
    expect(digest.body).toContain("Week of 2026-07-06");
    expect(digest.body).toContain("@lanmoves");
    expect(digest.body).toContain("Followers: 42,000 (+5.0% this week)");
    expect(digest.body).toContain("Save rate: 0.40%");
    expect(digest.body).toContain("our lead signal");
    expect(digest.body).toContain("Latest audit score: 65/100");
  });

  it("counts profiles in the subject for multi-profile digests", () => {
    const digest = composeDigest(
      [profile(), profile({ handle: "quietcardio" })],
      WEEK,
    );
    expect(digest.subject).toBe("Your week on TikTok search: 2 profiles");
    expect(digest.body).toContain("@quietcardio");
  });

  it("omits the audit line when no audit exists and survives zero starts", () => {
    const digest = composeDigest(
      [
        profile({
          latestAuditScore: null,
          followers: { start: 0, end: 100 },
        }),
      ],
      WEEK,
    );
    expect(digest.body).not.toContain("Latest audit score");
    expect(digest.body).toContain("Followers: 100 (n/a this week)");
  });

  it("always carries the non-affiliation disclaimer", () => {
    const digest = composeDigest([profile()], WEEK);
    expect(digest.body).toContain(
      "not affiliated with, endorsed by, or sponsored by TikTok",
    );
  });
});
