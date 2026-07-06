import { describe, expect, it } from "vitest";
import { CHECK_WEIGHTS, computeAuditScore, gradeForScore } from "@/lib/scoring";
import type {
  AuditInput,
  Check,
  CreatorRecord,
  KeywordStat,
  NicheBenchmarks,
  VideoRecord,
} from "@/lib/scoring";

const NOW = new Date("2026-07-01T00:00:00Z");

const kw = (keyword: string, monthlyVolume: number): KeywordStat => ({
  keyword,
  monthlyVolume,
});

const KEYWORDS: KeywordStat[] = [
  kw("home workout", 2_100_000),
  kw("workout at home", 1_500_000),
  kw("fat burning", 900_000),
  kw("morning routine", 800_000),
  kw("hiit for beginners", 400_000),
  kw("no equipment workout", 350_000),
  kw("apartment friendly workout", 120_000),
  kw("dumbbell legs", 90_000),
  kw("standing abs", 60_000),
  kw("quiet cardio", 30_000),
];

const BENCHMARKS: NicheBenchmarks = {
  topKeywords: KEYWORDS,
  medianPostsPerWeek: 3,
  medianEngagementRate: 0.05,
  medianSaveRate: 0.01,
};

function makeCreator(overrides: Partial<CreatorRecord> = {}): CreatorRecord {
  return {
    handle: "lanmoves",
    displayName: "Lan | Home Workout Coach",
    bio: "Home workout coach. HIIT for beginners, no equipment workout plans.",
    followerCount: 42_000,
    ...overrides,
  };
}

function makeVideo(overrides: Partial<VideoRecord> = {}): VideoRecord {
  return {
    caption:
      "Home workout for small spaces — day 1 🔥 #homeworkout #quietcardio",
    hashtags: ["homeworkout", "quietcardio", "fatburning", "standingabs"],
    postedAt: "2026-06-15T12:00:00Z",
    stats: { views: 10_000, likes: 400, comments: 50, bookmarks: 150 },
    ...overrides,
  };
}

/** 15 qualifying videos spread over the last 30 days (>= 3/week cadence). */
function makeVideos(count = 15): VideoRecord[] {
  return Array.from({ length: count }, (_, i) =>
    makeVideo({
      postedAt: new Date(Date.UTC(2026, 5, 2 + i * 2, 12)).toISOString(),
    }),
  );
}

function makeInput(overrides: Partial<AuditInput> = {}): AuditInput {
  return {
    creator: makeCreator(),
    videos: makeVideos(),
    benchmarks: BENCHMARKS,
    ...overrides,
  };
}

function check(result: { checks: Check[] }, id: string): Check {
  const found = result.checks.find((c) => c.id === id);
  if (!found) throw new Error(`missing check: ${id}`);
  return found;
}

describe("computeAuditScore — overall shape", () => {
  it("gives a fully optimized creator 100/A with all checks passing", () => {
    const result = computeAuditScore(makeInput(), { now: NOW });
    expect(result.score).toBe(100);
    expect(result.grade).toBe("A");
    expect(result.checks).toHaveLength(6);
    expect(result.checks.every((c) => c.status === "pass")).toBe(true);
  });

  it("emits six uniquely-identified checks whose weights sum to 100", () => {
    const result = computeAuditScore(makeInput(), { now: NOW });
    const ids = result.checks.map((c) => c.id);
    expect(new Set(ids).size).toBe(6);
    expect(result.checks.reduce((sum, c) => sum + c.weight, 0)).toBe(100);
    expect(Object.values(CHECK_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("is deterministic for identical input", () => {
    const a = computeAuditScore(makeInput(), { now: NOW });
    const b = computeAuditScore(makeInput(), { now: NOW });
    expect(a).toEqual(b);
  });

  it("scores an empty creator with no videos near the floor", () => {
    const result = computeAuditScore(
      makeInput({
        creator: makeCreator({ handle: "", displayName: "", bio: "" }),
        videos: [],
      }),
      { now: NOW },
    );
    // caption + cadence warn at half credit (sparse data); everything else 0.
    expect(result.score).toBe(18);
    expect(result.grade).toBe("F");
    expect(check(result, "name-keyword").status).toBe("fail");
    expect(check(result, "bio-keyword-coverage").status).toBe("fail");
    expect(check(result, "hashtag-strategy").status).toBe("fail");
    expect(check(result, "engagement-quality").status).toBe("fail");
  });

  it("only considers the 30 most recent videos", () => {
    // 40 old non-qualifying videos + 30 recent qualifying ones: the old ones
    // must not dilute the caption share.
    const old = Array.from({ length: 40 }, (_, i) =>
      makeVideo({
        caption: "🔥🔥🔥",
        postedAt: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(),
      }),
    );
    const recent = Array.from({ length: 30 }, (_, i) =>
      makeVideo({
        postedAt: new Date(Date.UTC(2026, 5, 1 + i, 8)).toISOString(),
      }),
    );
    const result = computeAuditScore(
      makeInput({ videos: [...old, ...recent] }),
      {
        now: NOW,
      },
    );
    expect(check(result, "caption-seo").status).toBe("pass");
    expect(result.score).toBe(100);
  });
});

describe("check 1 — name-field keyword", () => {
  it("fails when the display name only repeats the handle", () => {
    const result = computeAuditScore(
      makeInput({
        creator: makeCreator({
          handle: "homeworkout",
          displayName: "HomeWorkout",
        }),
        benchmarks: {
          ...BENCHMARKS,
          topKeywords: [kw("homeworkout", 500_000)],
        },
      }),
      { now: NOW },
    );
    const c = check(result, "name-keyword");
    expect(c.status).toBe("fail");
    expect(c.fixHint).toContain("homeworkout");
  });

  it("passes when the display name has a keyword beyond the handle", () => {
    const result = computeAuditScore(
      makeInput({
        creator: makeCreator({
          handle: "@lanmoves",
          displayName: "lanmoves • Quiet Cardio",
        }),
      }),
      { now: NOW },
    );
    expect(check(result, "name-keyword").status).toBe("pass");
  });

  it("includes a volume-specific fix hint on failure", () => {
    const result = computeAuditScore(
      makeInput({ creator: makeCreator({ displayName: "Lan" }) }),
      { now: NOW },
    );
    const c = check(result, "name-keyword");
    expect(c.status).toBe("fail");
    expect(c.fixHint).toContain('"home workout"');
    expect(c.fixHint).toContain("2.1M");
  });
});

describe("check 2 — bio keyword coverage", () => {
  it("gives partial credit for exactly one keyword", () => {
    const result = computeAuditScore(
      makeInput({
        creator: makeCreator({ bio: "HIIT for beginners every day." }),
      }),
      { now: NOW },
    );
    const c = check(result, "bio-keyword-coverage");
    expect(c.status).toBe("warn");
    // 100 - half of the bio weight
    expect(result.score).toBe(90);
  });

  it("fails an empty bio with an actionable, volume-specific hint", () => {
    const result = computeAuditScore(
      makeInput({ creator: makeCreator({ bio: "" }) }),
      { now: NOW },
    );
    const c = check(result, "bio-keyword-coverage");
    expect(c.status).toBe("fail");
    expect(c.detail).toMatch(/empty/i);
    expect(c.fixHint).toMatch(
      /Add "home workout" to your bio — 2\.1M searches/,
    );
  });

  it("matches keywords case-insensitively with diacritics", () => {
    const viKeywords = [
      kw("bài tập tại nhà", 600_000),
      kw("giảm mỡ bụng", 250_000),
    ];
    const result = computeAuditScore(
      makeInput({
        creator: makeCreator({ bio: "BÀI TẬP TẠI NHÀ & Giảm mỡ bụng 💪" }),
        benchmarks: { ...BENCHMARKS, topKeywords: viKeywords },
      }),
      { now: NOW },
    );
    expect(check(result, "bio-keyword-coverage").status).toBe("pass");
  });
});

describe("check 3 — caption SEO", () => {
  it("rejects captions that are only hashtags or only emoji", () => {
    const videos = [
      ...Array.from({ length: 5 }, () =>
        makeVideo({ caption: "#homeworkout #fatburning" }),
      ),
      ...Array.from({ length: 5 }, () => makeVideo({ caption: "🔥🔥🔥💪💪" })),
    ];
    const result = computeAuditScore(makeInput({ videos }), { now: NOW });
    const c = check(result, "caption-seo");
    expect(c.status).toBe("fail");
    expect(c.detail).toContain("0 of your last 10");
  });

  it("ignores keywords that appear after the first 80 characters", () => {
    const videos = Array.from({ length: 10 }, () =>
      makeVideo({ caption: "x".repeat(85) + " home workout" }),
    );
    const result = computeAuditScore(makeInput({ videos }), { now: NOW });
    expect(check(result, "caption-seo").status).toBe("fail");
  });

  it("counts code points so emoji do not eat the 80-character window", () => {
    // 40 emoji = 80 UTF-16 units; a UTF-16 slice would cut the keyword off.
    const videos = Array.from({ length: 10 }, () =>
      makeVideo({ caption: "🔥".repeat(40) + " home workout for beginners" }),
    );
    const result = computeAuditScore(makeInput({ videos }), { now: NOW });
    expect(check(result, "caption-seo").status).toBe("pass");
  });

  it("awards proportional credit and warns at a middling share", () => {
    // 6 of 15 qualifying captions; dates keep every other check passing.
    const videos = makeVideos().map((v, i) =>
      i < 6 ? v : { ...v, caption: "just vibes" },
    );
    const result = computeAuditScore(makeInput({ videos }), { now: NOW });
    const c = check(result, "caption-seo");
    expect(c.status).toBe("warn");
    expect(c.detail).toContain("6 of your last 15");
    // 100 - (1 - 0.4) * 20 = 88
    expect(result.score).toBe(88);
  });

  it("matches non-latin keyword phrases in captions", () => {
    const idKeywords = [
      kw("olahraga di rumah", 700_000),
      kw("diet sehat", 300_000),
    ];
    const videos = Array.from({ length: 10 }, () =>
      makeVideo({ caption: "Olahraga di rumah 10 menit, tanpa alat! 🇮🇩" }),
    );
    const result = computeAuditScore(
      makeInput({
        creator: makeCreator({ bio: "Olahraga di rumah + diet sehat" }),
        videos,
        benchmarks: { ...BENCHMARKS, topKeywords: idKeywords },
      }),
      { now: NOW },
    );
    expect(check(result, "caption-seo").status).toBe("pass");
  });
});

describe("check 4 — hashtag strategy", () => {
  it("passes with a 3-6 median and a high-volume + niche mix", () => {
    const result = computeAuditScore(makeInput(), { now: NOW });
    const c = check(result, "hashtag-strategy");
    expect(c.status).toBe("pass");
    expect(c.detail).toContain("Median 4 hashtags");
  });

  it("warns when the median is out of range but the mix is right", () => {
    const videos = makeVideos().map((v) => ({
      ...v,
      hashtags: [
        "homeworkout",
        "quietcardio",
        "fyp",
        "viral",
        "fitness",
        "gym",
        "health",
        "wellness",
        "sport",
        "training",
      ],
    }));
    const result = computeAuditScore(makeInput({ videos }), { now: NOW });
    const c = check(result, "hashtag-strategy");
    expect(c.status).toBe("warn");
    expect(c.detail).toContain("Median 10 hashtags");
  });

  it("warns when tags are all high-volume with no niche tags", () => {
    const videos = makeVideos().map((v) => ({
      ...v,
      hashtags: ["homeworkout", "workoutathome", "fatburning"],
    }));
    const result = computeAuditScore(makeInput({ videos }), { now: NOW });
    const c = check(result, "hashtag-strategy");
    expect(c.status).toBe("warn");
    expect(c.detail).toContain("no niche tags");
  });

  it("fails with no hashtags at all", () => {
    const videos = makeVideos().map((v) => ({ ...v, hashtags: [] }));
    const result = computeAuditScore(makeInput({ videos }), { now: NOW });
    expect(check(result, "hashtag-strategy").status).toBe("fail");
  });

  it("suggests concrete high-volume and niche tags in the fix hint", () => {
    const videos = makeVideos().map((v) => ({ ...v, hashtags: [] }));
    const result = computeAuditScore(makeInput({ videos }), { now: NOW });
    const c = check(result, "hashtag-strategy");
    expect(c.fixHint).toContain("#homeworkout");
    expect(c.fixHint).toContain("#quietcardio");
  });
});

describe("check 5 — posting cadence", () => {
  it("fails when all videos are older than the 30-day window", () => {
    const videos = Array.from({ length: 10 }, (_, i) =>
      makeVideo({ postedAt: new Date(Date.UTC(2026, 3, 1 + i)).toISOString() }),
    );
    const result = computeAuditScore(makeInput({ videos }), { now: NOW });
    const c = check(result, "posting-cadence");
    expect(c.status).toBe("fail");
    expect(c.detail).toContain("0 videos/week");
  });

  it("warns between 50% and 100% of the niche median", () => {
    // 7 videos in 30 days ≈ 1.63/week vs median 3 → above half, below median.
    const videos = Array.from({ length: 7 }, (_, i) =>
      makeVideo({
        postedAt: new Date(Date.UTC(2026, 5, 2 + i * 4)).toISOString(),
      }),
    );
    const result = computeAuditScore(makeInput({ videos }), { now: NOW });
    expect(check(result, "posting-cadence").status).toBe("warn");
  });

  it("passes any cadence when the niche has no benchmark", () => {
    const result = computeAuditScore(
      makeInput({ benchmarks: { ...BENCHMARKS, medianPostsPerWeek: 0 } }),
      { now: NOW },
    );
    expect(check(result, "posting-cadence").status).toBe("pass");
  });

  it("skips videos with unparseable dates instead of crashing", () => {
    // 14 dated videos keep cadence above the median even without the bad one.
    const videos = [...makeVideos(14), makeVideo({ postedAt: "not-a-date" })];
    const result = computeAuditScore(makeInput({ videos }), { now: NOW });
    expect(check(result, "posting-cadence").status).toBe("pass");
  });
});

describe("check 6 — engagement quality", () => {
  it("earns full credit on save rate alone, even with engagement rate below median", () => {
    // ER = (100+50+150)/10000 = 3% < 5% median; save rate 1.5% >= 1% median.
    const videos = makeVideos().map((v) => ({
      ...v,
      stats: { views: 10_000, likes: 100, comments: 50, bookmarks: 150 },
    }));
    const result = computeAuditScore(makeInput({ videos }), { now: NOW });
    const c = check(result, "engagement-quality");
    expect(c.status).toBe("pass");
    expect(result.score).toBe(100);
  });

  it("warns when engagement rate meets the median but saves lag", () => {
    // ER = (400+50+50)/10000 = 5% = median; save rate 0.5% < 1% median.
    const videos = makeVideos().map((v) => ({
      ...v,
      stats: { views: 10_000, likes: 400, comments: 50, bookmarks: 50 },
    }));
    const result = computeAuditScore(makeInput({ videos }), { now: NOW });
    const c = check(result, "engagement-quality");
    expect(c.status).toBe("warn");
    expect(c.fixHint).toMatch(/sav/i);
    expect(result.score).toBe(93);
  });

  it("fails when both metrics are below their medians", () => {
    const videos = makeVideos().map((v) => ({
      ...v,
      stats: { views: 10_000, likes: 100, comments: 20, bookmarks: 10 },
    }));
    const result = computeAuditScore(makeInput({ videos }), { now: NOW });
    expect(check(result, "engagement-quality").status).toBe("fail");
    expect(result.score).toBe(85);
  });
});

describe("sparse and degenerate data", () => {
  it("warns (not fails) caption and cadence checks with fewer than 5 videos", () => {
    const result = computeAuditScore(makeInput({ videos: makeVideos(4) }), {
      now: NOW,
    });
    for (const id of ["caption-seo", "posting-cadence"]) {
      const c = check(result, id);
      expect(c.status).toBe("warn");
      expect(c.detail).toMatch(/not enough recent videos/i);
    }
  });

  it("evaluates trend checks normally at exactly 5 videos", () => {
    const result = computeAuditScore(makeInput({ videos: makeVideos(5) }), {
      now: NOW,
    });
    expect(check(result, "caption-seo").detail).not.toMatch(/not enough/i);
  });

  it("handles a single video without crashing", () => {
    const result = computeAuditScore(makeInput({ videos: makeVideos(1) }), {
      now: NOW,
    });
    expect(Number.isFinite(result.score)).toBe(true);
    expect(check(result, "caption-seo").status).toBe("warn");
    expect(check(result, "posting-cadence").status).toBe("warn");
  });

  it("handles zero followers and zero views without NaN", () => {
    const videos = makeVideos().map((v) => ({
      ...v,
      stats: { views: 0, likes: 0, comments: 0, bookmarks: 0 },
    }));
    const result = computeAuditScore(
      makeInput({ creator: makeCreator({ followerCount: 0 }), videos }),
      { now: NOW },
    );
    expect(Number.isFinite(result.score)).toBe(true);
    const c = check(result, "engagement-quality");
    expect(c.status).toBe("fail");
    expect(c.detail).toContain("0.0%");
  });

  it("degrades keyword-dependent checks to warn when the keyword list is empty", () => {
    const result = computeAuditScore(
      makeInput({ benchmarks: { ...BENCHMARKS, topKeywords: [] } }),
      { now: NOW },
    );
    for (const id of ["name-keyword", "bio-keyword-coverage", "caption-seo"]) {
      const c = check(result, id);
      expect(c.status).toBe("warn");
      expect(c.detail).toMatch(/no keyword data/i);
    }
    // hashtag mix can only be half-evaluated (count is still measurable)
    expect(check(result, "hashtag-strategy").status).toBe("warn");
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it("uses the fallback sparse hint when keywords are empty too", () => {
    const result = computeAuditScore(
      makeInput({ videos: [], benchmarks: { ...BENCHMARKS, topKeywords: [] } }),
      { now: NOW },
    );
    expect(check(result, "posting-cadence").fixHint).toMatch(/at least 5/i);
  });
});

describe("malformed input tolerance", () => {
  it("never crashes on undefined creator fields, captions, hashtags, or stats", () => {
    const creator = {
      handle: undefined,
      displayName: undefined,
      bio: undefined,
      followerCount: 0,
    } as unknown as CreatorRecord;
    const videos = Array.from({ length: 6 }, () => ({
      caption: undefined,
      hashtags: undefined,
      postedAt: new Date("2026-06-20T00:00:00Z"),
      stats: undefined,
    })) as unknown as VideoRecord[];
    const result = computeAuditScore(
      { creator, videos, benchmarks: BENCHMARKS },
      { now: NOW },
    );
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.checks).toHaveLength(6);
  });

  it("treats missing benchmarks and videos as empty without crashing", () => {
    const input = {
      creator: makeCreator(),
      videos: undefined,
      benchmarks: undefined,
    } as unknown as AuditInput;
    const result = computeAuditScore(input, { now: NOW });
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.checks).toHaveLength(6);
  });

  it("accepts Date objects for postedAt", () => {
    const videos = makeVideos().map((v) => ({
      ...v,
      postedAt: new Date(v.postedAt as string),
    }));
    const result = computeAuditScore(makeInput({ videos }), { now: NOW });
    expect(check(result, "posting-cadence").status).toBe("pass");
  });

  it("acknowledges a bio that already covers every top keyword", () => {
    const bio = KEYWORDS.map((k) => k.keyword).join(" · ");
    const result = computeAuditScore(
      makeInput({ creator: makeCreator({ bio }) }),
      { now: NOW },
    );
    const c = check(result, "bio-keyword-coverage");
    expect(c.status).toBe("pass");
    expect(c.fixHint).toMatch(/already covers/i);
  });

  it("fails the tag mix when a short keyword list matches no tags", () => {
    const videos = makeVideos().map((v) => ({
      ...v,
      hashtags: ["fyp", "viral", "dance"],
    }));
    const result = computeAuditScore(
      makeInput({
        videos,
        benchmarks: {
          ...BENCHMARKS,
          topKeywords: [
            kw("home workout", 2_100_000),
            kw("quiet cardio", 30_000),
          ],
        },
      }),
      { now: NOW },
    );
    const c = check(result, "hashtag-strategy");
    expect(c.status).toBe("warn"); // tag count is fine, mix is not
    expect(c.detail).toContain("none of your tags match");
  });

  it("uses generic placeholder tags in the hashtag hint without keyword data", () => {
    const result = computeAuditScore(
      makeInput({ benchmarks: { ...BENCHMARKS, topKeywords: [] } }),
      { now: NOW },
    );
    expect(check(result, "hashtag-strategy").fixHint).toContain("#yourtopic");
  });
});

describe("gradeForScore", () => {
  it("maps scores to letter grades at the standard boundaries", () => {
    expect(gradeForScore(100)).toBe("A");
    expect(gradeForScore(90)).toBe("A");
    expect(gradeForScore(89)).toBe("B");
    expect(gradeForScore(80)).toBe("B");
    expect(gradeForScore(79)).toBe("C");
    expect(gradeForScore(70)).toBe("C");
    expect(gradeForScore(69)).toBe("D");
    expect(gradeForScore(60)).toBe("D");
    expect(gradeForScore(59)).toBe("F");
    expect(gradeForScore(0)).toBe("F");
  });
});
