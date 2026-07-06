import { describe, expect, it } from "vitest";
import {
  containsKeyword,
  firstCodePoints,
  formatSearchVolume,
  hashtagMatchesKeyword,
  median,
  normalizeText,
  stripEmoji,
  stripHashtags,
} from "./text";

describe("normalizeText", () => {
  it("case-folds and NFKC-normalizes", () => {
    expect(normalizeText("Home WORKOUT")).toBe("home workout");
    // NFD (decomposed) Vietnamese normalizes to the same string as NFC
    expect(normalizeText("bài".normalize("NFD"))).toBe("bài");
  });

  it("lowercases Vietnamese diacritics", () => {
    expect(normalizeText("BÀI TẬP TẠI NHÀ")).toBe("bài tập tại nhà");
  });

  it("tolerates null-ish input", () => {
    expect(normalizeText(undefined as unknown as string)).toBe("");
  });
});

describe("containsKeyword", () => {
  it("matches case-insensitively across scripts", () => {
    expect(containsKeyword("Bài tập tại nhà cho bạn", "bài tập tại nhà")).toBe(
      true,
    );
    expect(containsKeyword("olahraga di rumah tiap pagi", "olahraga")).toBe(
      true,
    );
  });

  it("returns false for empty or whitespace keywords", () => {
    expect(containsKeyword("anything", "")).toBe(false);
    expect(containsKeyword("anything", "   ")).toBe(false);
  });

  it("returns false when the keyword is absent", () => {
    expect(containsKeyword("morning yoga", "home workout")).toBe(false);
  });
});

describe("stripHashtags / stripEmoji", () => {
  it("removes hashtag tokens including unicode tags", () => {
    const stripped = stripHashtags("hello #fitness #bàitậptạinhà world");
    expect(stripped.replace(/\s+/g, " ").trim()).toBe("hello world");
  });

  it("removes emoji but keeps text", () => {
    expect(stripEmoji("🔥 workout 💪🏽 time")).toContain("workout");
    expect(stripEmoji("🔥💪")).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("firstCodePoints", () => {
  it("counts code points, not UTF-16 units", () => {
    // 40 fire emoji are 80 UTF-16 units but only 40 code points.
    const text = "🔥".repeat(40) + "home workout";
    expect(firstCodePoints(text, 80)).toContain("home workout");
  });

  it("never splits surrogate pairs", () => {
    expect(firstCodePoints("🔥🔥🔥", 2)).toBe("🔥🔥");
  });

  it("tolerates null-ish input", () => {
    expect(firstCodePoints(undefined as unknown as string, 5)).toBe("");
  });
});

describe("hashtagMatchesKeyword", () => {
  it("matches keywords with spaces removed", () => {
    expect(hashtagMatchesKeyword("homeworkout", "home workout")).toBe(true);
    expect(hashtagMatchesKeyword("#HomeWorkoutDaily", "home workout")).toBe(
      true,
    );
    expect(hashtagMatchesKeyword("bàitậptạinhà", "bài tập tại nhà")).toBe(true);
  });

  it("rejects unrelated tags and empty keywords", () => {
    expect(hashtagMatchesKeyword("morningyoga", "home workout")).toBe(false);
    expect(hashtagMatchesKeyword("anything", " ")).toBe(false);
  });
});

describe("median", () => {
  it("handles empty, odd, and even inputs", () => {
    expect(median([])).toBe(0);
    expect(median([4])).toBe(4);
    expect(median([9, 1, 2])).toBe(2);
    expect(median([10, 1, 2, 3])).toBe(2.5);
  });
});

describe("formatSearchVolume", () => {
  it("formats millions, thousands, and small numbers", () => {
    expect(formatSearchVolume(2_100_000)).toBe("2.1M");
    expect(formatSearchVolume(1_000_000)).toBe("1M");
    expect(formatSearchVolume(15_300)).toBe("15.3K");
    expect(formatSearchVolume(30_000)).toBe("30K");
    expect(formatSearchVolume(950)).toBe("950");
  });

  it("clamps zero, negative, and non-finite values to 0", () => {
    expect(formatSearchVolume(0)).toBe("0");
    expect(formatSearchVolume(-5)).toBe("0");
    expect(formatSearchVolume(Number.NaN)).toBe("0");
  });
});
