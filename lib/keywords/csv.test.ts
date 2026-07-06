import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("joins headers and rows with CRLF", () => {
    const csv = toCsv(["a", "b"], [[1, 2]]);
    expect(csv).toBe("a,b\r\n1,2\r\n");
  });

  it("quotes cells containing commas, quotes, and newlines", () => {
    const csv = toCsv(["term"], [['say "hi", ok'], ["line\nbreak"]]);
    expect(csv).toContain('"say ""hi"", ok"');
    expect(csv).toContain('"line\nbreak"');
  });

  it("renders null/undefined as empty cells and handles unicode", () => {
    const csv = toCsv(["a", "b", "c"], [[null, undefined, "bài tập tại nhà"]]);
    expect(csv).toContain(",,bài tập tại nhà");
  });
});
