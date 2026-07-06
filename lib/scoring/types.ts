export type CheckStatus = "pass" | "warn" | "fail";

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  fixHint: string;
  weight: number;
}

export interface AuditResult {
  /** Integer 0-100. */
  score: number;
  grade: Grade;
  checks: Check[];
}

export interface VideoStats {
  views: number;
  likes: number;
  comments: number;
  bookmarks: number;
}

export interface VideoRecord {
  caption: string;
  hashtags: string[];
  postedAt: Date | string;
  stats: VideoStats;
}

export interface CreatorRecord {
  handle: string;
  displayName: string;
  bio: string;
  followerCount: number;
}

/** One of the top search keywords for a niche, from our index. */
export interface KeywordStat {
  keyword: string;
  /** Monthly search volume for the keyword within the niche. */
  monthlyVolume: number;
}

/** Shape returned by getNicheBenchmarks (lib/data). */
export interface NicheBenchmarks {
  /** Top-10 search keywords for the niche, any order. */
  topKeywords: KeywordStat[];
  medianPostsPerWeek: number;
  /** Median engagement rate: (likes + comments + bookmarks) / views. */
  medianEngagementRate: number;
  /** Median save rate: bookmarks / views. */
  medianSaveRate: number;
}

export interface AuditInput {
  creator: CreatorRecord;
  /** The creator's most recent videos; only the newest 30 are considered. */
  videos: VideoRecord[];
  benchmarks: NicheBenchmarks;
}

export interface AuditOptions {
  /**
   * Reference time for the posting-cadence window. Defaults to the current
   * time; pass a fixed date for deterministic output.
   */
  now?: Date;
}
