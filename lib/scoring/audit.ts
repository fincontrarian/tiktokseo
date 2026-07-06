import { computeEngagementRate, computeSaveRate } from "./engagement";
import {
  containsKeyword,
  firstCodePoints,
  formatSearchVolume,
  hashtagMatchesKeyword,
  hashtagify,
  median,
  normalizeText,
  stripEmoji,
  stripHashtags,
} from "./text";
import type {
  AuditInput,
  AuditOptions,
  AuditResult,
  Check,
  CheckStatus,
  CreatorRecord,
  Grade,
  KeywordStat,
  NicheBenchmarks,
  VideoRecord,
} from "./types";

export const CHECK_WEIGHTS = {
  nameKeyword: 15,
  bioKeywords: 20,
  captionSeo: 20,
  hashtagStrategy: 15,
  postingCadence: 15,
  engagementQuality: 15,
} as const;

/** Below this many videos, trend checks (caption, cadence) warn instead of failing. */
const MIN_VIDEOS_FOR_TREND_CHECKS = 5;
/** Caption window: TikTok search weighs the opening of the caption. */
const CAPTION_SEO_WINDOW = 80;
const CADENCE_WINDOW_DAYS = 30;
const WEEKS_IN_WINDOW = CADENCE_WINDOW_DAYS / 7;
const MAX_VIDEOS = 30;

const NO_KEYWORD_DATA_DETAIL =
  "No keyword data is available for this niche yet, so this check could not be fully evaluated.";
const NO_KEYWORD_DATA_HINT =
  "Re-run the audit once keyword benchmarks for this niche are populated in our index.";

interface ScoredCheck {
  check: Check;
  points: number;
}

export function computeAuditScore(
  input: AuditInput,
  options: AuditOptions = {},
): AuditResult {
  const now = options.now ?? new Date();
  const creator = input.creator;
  const benchmarks = input.benchmarks;
  const keywords = benchmarks?.topKeywords ?? [];
  const videos = mostRecentVideos(input.videos ?? [], MAX_VIDEOS);

  const scored = [
    nameKeywordCheck(creator, keywords),
    bioKeywordCheck(creator, keywords),
    captionSeoCheck(videos, keywords),
    hashtagStrategyCheck(videos, keywords),
    postingCadenceCheck(videos, benchmarks, now),
    engagementQualityCheck(videos, benchmarks),
  ];

  const total = scored.reduce((sum, item) => sum + item.points, 0);
  const score = clamp(Math.round(total), 0, 100);
  return {
    score,
    grade: gradeForScore(score),
    checks: scored.map((item) => item.check),
  };
}

export function gradeForScore(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

// --- Check 1: name-field keyword (15) -------------------------------------

function nameKeywordCheck(
  creator: CreatorRecord,
  keywords: KeywordStat[],
): ScoredCheck {
  const weight = CHECK_WEIGHTS.nameKeyword;
  const base = { id: "name-keyword", label: "Name-field keyword", weight };

  if (keywords.length === 0) {
    return {
      points: weight / 2,
      check: {
        ...base,
        status: "warn",
        detail: NO_KEYWORD_DATA_DETAIL,
        fixHint: NO_KEYWORD_DATA_HINT,
      },
    };
  }

  // Only keywords beyond the handle itself count: a display name that merely
  // repeats the handle is not name-field SEO.
  const handle = normalizeText(creator.handle ?? "").replace(/^@/u, "");
  let name = normalizeText(creator.displayName ?? "");
  if (handle) {
    name = name.replaceAll("@" + handle, " ").replaceAll(handle, " ");
  }
  const matched = keywords.find((k) => containsKeyword(name, k.keyword));

  const top = keywords[0];
  if (matched) {
    return {
      points: weight,
      check: {
        ...base,
        status: "pass",
        detail: `Your display name contains the niche keyword "${matched.keyword}".`,
        fixHint: `Keep a niche keyword like "${matched.keyword}" in your display name — the name field is indexed for search.`,
      },
    };
  }
  return {
    points: 0,
    check: {
      ...base,
      status: "fail",
      detail:
        "Your display name has no niche keyword beyond your handle, so it cannot rank for niche searches.",
      fixHint: `Add "${top.keyword}" to your display name — ${formatSearchVolume(top.monthlyVolume)} searches in your niche.`,
    },
  };
}

// --- Check 2: bio keyword coverage (20) ------------------------------------

function bioKeywordCheck(
  creator: CreatorRecord,
  keywords: KeywordStat[],
): ScoredCheck {
  const weight = CHECK_WEIGHTS.bioKeywords;
  const base = {
    id: "bio-keyword-coverage",
    label: "Bio keyword coverage",
    weight,
  };

  if (keywords.length === 0) {
    return {
      points: weight / 2,
      check: {
        ...base,
        status: "warn",
        detail: NO_KEYWORD_DATA_DETAIL,
        fixHint: NO_KEYWORD_DATA_HINT,
      },
    };
  }

  const bio = creator.bio ?? "";
  const matches = keywords.filter((k) => containsKeyword(bio, k.keyword));
  const missing = keywords.filter((k) => !containsKeyword(bio, k.keyword));
  const suggestion = missing[0];
  const addHint = suggestion
    ? `Add "${suggestion.keyword}" to your bio — ${formatSearchVolume(suggestion.monthlyVolume)} searches in your niche.`
    : "Your bio already covers every top keyword for your niche — keep it that way.";

  if (matches.length >= 2) {
    return {
      points: weight,
      check: {
        ...base,
        status: "pass",
        detail: `Your bio covers ${matches.length} of the top-10 search keywords for your niche.`,
        fixHint: addHint,
      },
    };
  }
  if (matches.length === 1) {
    return {
      points: weight / 2,
      check: {
        ...base,
        status: "warn",
        detail: `Your bio covers only 1 top keyword ("${matches[0].keyword}"); at least 2 are needed for full credit.`,
        fixHint: addHint,
      },
    };
  }
  return {
    points: 0,
    check: {
      ...base,
      status: "fail",
      detail:
        bio.trim() === ""
          ? "Your bio is empty — it covers none of your niche's top search keywords."
          : "Your bio covers none of your niche's top-10 search keywords.",
      fixHint: addHint,
    },
  };
}

// --- Check 3: caption SEO (20) ----------------------------------------------

function captionSeoCheck(
  videos: VideoRecord[],
  keywords: KeywordStat[],
): ScoredCheck {
  const weight = CHECK_WEIGHTS.captionSeo;
  const base = { id: "caption-seo", label: "Caption SEO", weight };

  const sparse = sparseVideosCheck(videos, base, keywords);
  if (sparse) return sparse;

  if (keywords.length === 0) {
    return {
      points: weight / 2,
      check: {
        ...base,
        status: "warn",
        detail: NO_KEYWORD_DATA_DETAIL,
        fixHint: NO_KEYWORD_DATA_HINT,
      },
    };
  }

  // A caption qualifies when its first 80 code points contain a niche keyword
  // in plain text — hashtags and emoji are stripped first, so hashtag-only or
  // emoji-only openings never qualify.
  const qualifying = videos.filter((video) => {
    const head = firstCodePoints(video.caption ?? "", CAPTION_SEO_WINDOW);
    const plain = stripEmoji(stripHashtags(head));
    return keywords.some((k) => containsKeyword(plain, k.keyword));
  });
  const share = qualifying.length / videos.length;
  const status: CheckStatus =
    share >= 0.6 ? "pass" : share >= 0.3 ? "warn" : "fail";
  const top = keywords[0];

  return {
    points: weight * share,
    check: {
      ...base,
      status,
      detail: `${qualifying.length} of your last ${videos.length} captions open with a searchable keyword phrase in the first ${CAPTION_SEO_WINDOW} characters.`,
      fixHint: `Open captions with a phrase like "${top.keyword}" (${formatSearchVolume(top.monthlyVolume)} searches) in the first ${CAPTION_SEO_WINDOW} characters — plain text, not only hashtags or emoji.`,
    },
  };
}

// --- Check 4: hashtag strategy (15) -----------------------------------------

function hashtagStrategyCheck(
  videos: VideoRecord[],
  keywords: KeywordStat[],
): ScoredCheck {
  const weight = CHECK_WEIGHTS.hashtagStrategy;
  const base = { id: "hashtag-strategy", label: "Hashtag strategy", weight };
  const rangePoints = weight * 0.6;
  const mixPoints = weight * 0.4;

  const counts = videos.map((video) => (video.hashtags ?? []).length);
  const medianTags = median(counts);
  const inRange = videos.length > 0 && medianTags >= 3 && medianTags <= 6;
  const usedTags = videos.flatMap((video) => video.hashtags ?? []);

  // Volume terciles over the niche keyword list: the top third are
  // "high-volume" tags, the bottom third are "niche" tags.
  let earnedMix = 0;
  let mixNote: string;
  if (keywords.length === 0) {
    earnedMix = mixPoints / 2;
    mixNote = "tag mix could not be evaluated (no keyword volume data)";
  } else if (keywords.length < 3) {
    const anyMatch = usedTags.some((tag) =>
      keywords.some((k) => hashtagMatchesKeyword(tag, k.keyword)),
    );
    earnedMix = anyMatch ? mixPoints : 0;
    mixNote = anyMatch
      ? "your tags include niche keywords"
      : "none of your tags match niche keywords";
  } else {
    const sorted = [...keywords].sort(
      (a, b) => b.monthlyVolume - a.monthlyVolume,
    );
    const high = sorted.slice(0, Math.ceil(sorted.length / 3));
    const niche = sorted.slice(sorted.length - Math.floor(sorted.length / 3));
    const hasHigh = usedTags.some((tag) =>
      high.some((k) => hashtagMatchesKeyword(tag, k.keyword)),
    );
    const hasNiche = usedTags.some((tag) =>
      niche.some((k) => hashtagMatchesKeyword(tag, k.keyword)),
    );
    earnedMix =
      hasHigh && hasNiche ? mixPoints : hasHigh || hasNiche ? mixPoints / 2 : 0;
    mixNote =
      hasHigh && hasNiche
        ? "you mix high-volume and niche tags"
        : hasHigh
          ? "you use high-volume tags but no niche tags"
          : hasNiche
            ? "you use niche tags but no high-volume tags"
            : "your tags include neither high-volume nor niche keywords";
  }

  const points = (inRange ? rangePoints : 0) + earnedMix;
  const status: CheckStatus =
    points >= weight ? "pass" : points > 0 ? "warn" : "fail";
  const hintHigh = hashtagify(keywords[0]?.keyword ?? "your topic");
  const hintNiche = hashtagify(
    keywords[keywords.length - 1]?.keyword ?? "your sub-topic",
  );

  return {
    points,
    check: {
      ...base,
      status,
      detail: `Median ${formatNumber(medianTags)} hashtags per video (target 3-6), and ${mixNote}.`,
      fixHint: `Use 3-6 hashtags per video, mixing high-volume tags like #${hintHigh} with niche tags like #${hintNiche}.`,
    },
  };
}

// --- Check 5: posting cadence (15) -------------------------------------------

function postingCadenceCheck(
  videos: VideoRecord[],
  benchmarks: NicheBenchmarks,
  now: Date,
): ScoredCheck {
  const weight = CHECK_WEIGHTS.postingCadence;
  const base = { id: "posting-cadence", label: "Posting cadence", weight };

  const sparse = sparseVideosCheck(videos, base, benchmarks?.topKeywords ?? []);
  if (sparse) return sparse;

  const nowMs = now.getTime();
  const windowStart = nowMs - CADENCE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = videos.filter((video) => {
    const time = toTime(video.postedAt);
    return !Number.isNaN(time) && time >= windowStart && time <= nowMs;
  });
  const perWeek = recent.length / WEEKS_IN_WINDOW;
  const nicheMedian = benchmarks?.medianPostsPerWeek ?? 0;
  const fixHint = `Post at least ${formatNumber(Math.max(nicheMedian, 1))} times per week — the median for your niche — so fresh videos keep entering search.`;

  if (nicheMedian <= 0) {
    return {
      points: weight,
      check: {
        ...base,
        status: "pass",
        detail: `You posted ${formatNumber(perWeek)} videos/week over the last ${CADENCE_WINDOW_DAYS} days; your niche has no cadence benchmark yet, so any consistent schedule earns full credit.`,
        fixHint,
      },
    };
  }

  const detail = `You posted ${formatNumber(perWeek)} videos/week over the last ${CADENCE_WINDOW_DAYS} days vs a niche median of ${formatNumber(nicheMedian)}.`;
  if (perWeek >= nicheMedian) {
    return {
      points: weight,
      check: { ...base, status: "pass", detail, fixHint },
    };
  }
  if (perWeek >= nicheMedian / 2) {
    return {
      points: weight / 2,
      check: { ...base, status: "warn", detail, fixHint },
    };
  }
  return { points: 0, check: { ...base, status: "fail", detail, fixHint } };
}

// --- Check 6: engagement quality (15) ----------------------------------------

function engagementQualityCheck(
  videos: VideoRecord[],
  benchmarks: NicheBenchmarks,
): ScoredCheck {
  const weight = CHECK_WEIGHTS.engagementQuality;
  const base = {
    id: "engagement-quality",
    label: "Engagement quality",
    weight,
  };

  const engagementRate = computeEngagementRate(videos);
  const saveRate = computeSaveRate(videos);
  const medianEr = benchmarks?.medianEngagementRate ?? 0;
  const medianSr = benchmarks?.medianSaveRate ?? 0;
  const fixHint =
    "End videos with something worth saving — a routine, list, or template viewers will come back to. Save rate (bookmarks/views) is our lead ranking signal.";

  // Save rate at or above the niche median earns the full component on its
  // own — bookmarks are our lead signal — even if engagement rate is only at
  // the median.
  if (saveRate >= medianSr) {
    return {
      points: weight,
      check: {
        ...base,
        status: "pass",
        detail: `Save rate ${formatRate(saveRate)} is at or above the niche median (${formatRate(medianSr)}) — bookmarks are the strongest signal in our index.`,
        fixHint,
      },
    };
  }
  if (engagementRate >= medianEr) {
    return {
      points: weight / 2,
      check: {
        ...base,
        status: "warn",
        detail: `Engagement rate ${formatRate(engagementRate)} meets the niche median (${formatRate(medianEr)}), but save rate ${formatRate(saveRate)} is below the median ${formatRate(medianSr)}.`,
        fixHint,
      },
    };
  }
  return {
    points: 0,
    check: {
      ...base,
      status: "fail",
      detail: `Engagement rate ${formatRate(engagementRate)} and save rate ${formatRate(saveRate)} are both below the niche medians (${formatRate(medianEr)} / ${formatRate(medianSr)}).`,
      fixHint,
    },
  };
}

// --- Shared helpers -----------------------------------------------------------

function sparseVideosCheck(
  videos: VideoRecord[],
  base: { id: string; label: string; weight: number },
  keywords: KeywordStat[],
): ScoredCheck | undefined {
  if (videos.length >= MIN_VIDEOS_FOR_TREND_CHECKS) return undefined;
  const top = keywords[0];
  const hint = top
    ? `Post more videos around "${top.keyword}" (${formatSearchVolume(top.monthlyVolume)} searches) — at least ${MIN_VIDEOS_FOR_TREND_CHECKS} recent videos are needed for a reliable read.`
    : `Post at least ${MIN_VIDEOS_FOR_TREND_CHECKS} videos so this can be evaluated reliably.`;
  return {
    points: base.weight / 2,
    check: {
      ...base,
      status: "warn",
      detail: `Not enough recent videos to evaluate this (found ${videos.length}, need at least ${MIN_VIDEOS_FOR_TREND_CHECKS}).`,
      fixHint: hint,
    },
  };
}

function mostRecentVideos(videos: VideoRecord[], limit: number): VideoRecord[] {
  return videos
    .map((video, index) => ({ video, index, time: toTime(video.postedAt) }))
    .sort((a, b) => {
      const at = Number.isNaN(a.time) ? Number.NEGATIVE_INFINITY : a.time;
      const bt = Number.isNaN(b.time) ? Number.NEGATIVE_INFINITY : b.time;
      return bt - at || a.index - b.index;
    })
    .slice(0, limit)
    .map((entry) => entry.video);
}

function toTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
