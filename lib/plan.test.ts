import { describe, expect, it } from "vitest";
import { normalizePlan, PLAN_CONFIG, planConfig, PLANS } from "./plan";

describe("planConfig", () => {
  it("enforces the tracked-profile limits from the spec", () => {
    expect(planConfig("free").trackedProfileLimit).toBe(1);
    expect(planConfig("creator").trackedProfileLimit).toBe(1);
    expect(planConfig("pro").trackedProfileLimit).toBe(5);
  });

  it("limits free audit re-runs to 1/day per profile", () => {
    expect(planConfig("free").auditRerunsPerDay).toBe(1);
    expect(planConfig("creator").auditRerunsPerDay).toBeGreaterThan(1);
    expect(planConfig("pro").auditRerunsPerDay).toBeGreaterThan(
      planConfig("creator").auditRerunsPerDay,
    );
  });

  it("gates keyword freshness, row cap, and export by plan", () => {
    expect(planConfig("free")).toMatchObject({
      freshKeywordData: false,
      keywordRowCap: 3,
      csvExport: false,
    });
    for (const plan of ["creator", "pro"] as const) {
      expect(planConfig(plan)).toMatchObject({
        freshKeywordData: true,
        keywordRowCap: null,
        csvExport: true,
      });
    }
  });

  it("covers every plan exactly once", () => {
    expect(Object.keys(PLAN_CONFIG).sort()).toEqual([...PLANS].sort());
    for (const plan of PLANS) {
      expect(PLAN_CONFIG[plan].id).toBe(plan);
    }
  });
});

describe("normalizePlan", () => {
  it("passes valid plans through and defaults everything else to free", () => {
    expect(normalizePlan("creator")).toBe("creator");
    expect(normalizePlan("pro")).toBe("pro");
    expect(normalizePlan("free")).toBe("free");
    expect(normalizePlan("paid")).toBe("free");
    expect(normalizePlan("")).toBe("free");
    expect(normalizePlan(null)).toBe("free");
    expect(normalizePlan(undefined)).toBe("free");
  });
});
