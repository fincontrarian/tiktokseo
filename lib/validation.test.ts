import { describe, expect, it } from "vitest";
import { isValidEmail, isValidHandle, normalizeHandle } from "./validation";

describe("normalizeHandle", () => {
  it("strips @, trims, and lowercases", () => {
    expect(normalizeHandle("  @LanMoves ")).toBe("lanmoves");
    expect(normalizeHandle("@@double")).toBe("double");
    expect(normalizeHandle("plain.handle_1")).toBe("plain.handle_1");
  });

  it("tolerates null-ish input", () => {
    expect(normalizeHandle(undefined as unknown as string)).toBe("");
  });
});

describe("isValidHandle", () => {
  it("accepts TikTok-style usernames", () => {
    expect(isValidHandle("lanmoves")).toBe(true);
    expect(isValidHandle("quiet.cardio_1")).toBe(true);
  });

  it("rejects invalid characters, length, and empties", () => {
    expect(isValidHandle("")).toBe(false);
    expect(isValidHandle("a")).toBe(false);
    expect(isValidHandle("has space")).toBe(false);
    expect(isValidHandle("bài-tập")).toBe(false);
    expect(isValidHandle("x".repeat(25))).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("accepts plausible emails and rejects junk", () => {
    expect(isValidEmail("creator@example.com")).toBe(true);
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("spaces in@mail.com")).toBe(false);
    expect(isValidEmail("x".repeat(250) + "@a.com")).toBe(false);
  });
});
