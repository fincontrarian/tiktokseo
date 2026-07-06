import type { VideoRecord } from "./types";

function safeCount(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

/**
 * Aggregate engagement rate: (likes + comments + bookmarks) / views across
 * all given videos. Returns 0 when there are no views — never NaN/Infinity.
 * Deliberately view-based, not follower-based (see CLAUDE.md).
 */
export function computeEngagementRate(videos: VideoRecord[]): number {
  let views = 0;
  let interactions = 0;
  for (const video of videos ?? []) {
    views += safeCount(video.stats?.views);
    interactions +=
      safeCount(video.stats?.likes) +
      safeCount(video.stats?.comments) +
      safeCount(video.stats?.bookmarks);
  }
  return views > 0 ? interactions / views : 0;
}

/**
 * Aggregate save rate: bookmarks / views across all given videos. Bookmarks
 * are our lead ranking signal. Returns 0 when there are no views.
 */
export function computeSaveRate(videos: VideoRecord[]): number {
  let views = 0;
  let saves = 0;
  for (const video of videos ?? []) {
    views += safeCount(video.stats?.views);
    saves += safeCount(video.stats?.bookmarks);
  }
  return views > 0 ? saves / views : 0;
}
