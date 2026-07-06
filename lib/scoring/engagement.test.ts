import { describe, expect, it } from "vitest";
import { computeEngagementRate, computeSaveRate } from "./engagement";
import type { VideoRecord } from "./types";

function video(
  views: number,
  likes: number,
  comments: number,
  bookmarks: number,
): VideoRecord {
  return {
    caption: "",
    hashtags: [],
    postedAt: "2026-06-01T00:00:00Z",
    stats: { views, likes, comments, bookmarks },
  };
}

describe("computeEngagementRate", () => {
  it("sums interactions over views across videos", () => {
    const videos = [video(1000, 50, 10, 20), video(1000, 30, 10, 40)];
    expect(computeEngagementRate(videos)).toBeCloseTo(160 / 2000);
  });

  it("returns 0 for no videos", () => {
    expect(computeEngagementRate([])).toBe(0);
  });

  it("returns 0 (not NaN) when views are zero", () => {
    expect(computeEngagementRate([video(0, 10, 5, 2)])).toBe(0);
  });

  it("ignores negative and non-finite stats", () => {
    const bad = video(1000, -50, Number.NaN, 20);
    expect(computeEngagementRate([bad])).toBeCloseTo(20 / 1000);
  });

  it("treats an undefined video list as empty", () => {
    const none = undefined as unknown as VideoRecord[];
    expect(computeEngagementRate(none)).toBe(0);
    expect(computeSaveRate(none)).toBe(0);
  });
});

describe("computeSaveRate", () => {
  it("sums bookmarks over views", () => {
    const videos = [video(1000, 0, 0, 15), video(3000, 0, 0, 25)];
    expect(computeSaveRate(videos)).toBeCloseTo(40 / 4000);
  });

  it("returns 0 for empty input and zero views", () => {
    expect(computeSaveRate([])).toBe(0);
    expect(computeSaveRate([video(0, 0, 0, 99)])).toBe(0);
  });
});
