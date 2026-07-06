import { describe, expect, it } from "vitest";
import { sparklinePoints } from "./sparkline";

describe("sparklinePoints", () => {
  it("maps a rising series left-to-right, top-to-bottom inverted", () => {
    const points = sparklinePoints([0, 50, 100], 96, 28, 2);
    const pairs = points.split(" ").map((p) => p.split(",").map(Number));
    expect(pairs).toHaveLength(3);
    // x increases
    expect(pairs[0][0]).toBeLessThan(pairs[1][0]);
    expect(pairs[1][0]).toBeLessThan(pairs[2][0]);
    // y decreases (SVG y-axis points down; higher value = higher on chart)
    expect(pairs[0][1]).toBeGreaterThan(pairs[2][1]);
    // stays within the viewBox
    for (const [x, y] of pairs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(96);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(28);
    }
  });

  it("handles empty, single-value, and constant series", () => {
    expect(sparklinePoints([])).toBe("");
    expect(sparklinePoints([42]).split(" ")).toHaveLength(1);
    // constant series: span guards against divide-by-zero
    const flat = sparklinePoints([5, 5, 5]);
    expect(flat.split(" ")).toHaveLength(3);
    for (const pair of flat.split(" ")) {
      expect(Number(pair.split(",")[1])).not.toBeNaN();
    }
  });

  it("ignores non-finite values", () => {
    const points = sparklinePoints([1, Number.NaN, 3]);
    expect(points.split(" ")).toHaveLength(2);
  });
});
