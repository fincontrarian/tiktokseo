/**
 * Unicode-safe text helpers for keyword matching across en/vi/id captions,
 * including diacritics, emoji, and mixed scripts. Matching is substring-based
 * after NFKC normalization + case folding, which also works for scripts
 * without word boundaries.
 */

const HASHTAG_RE = /#[^\s#]+/gu;
const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu;

export function normalizeText(text: string): string {
  return (text ?? "").normalize("NFKC").toLowerCase();
}

export function stripHashtags(text: string): string {
  return text.replace(HASHTAG_RE, " ");
}

export function stripEmoji(text: string): string {
  return text.replace(EMOJI_RE, "");
}

/** First `count` Unicode code points (never splits surrogate pairs). */
export function firstCodePoints(text: string, count: number): string {
  return Array.from(text ?? "")
    .slice(0, count)
    .join("");
}

/** Case- and normalization-insensitive substring match. */
export function containsKeyword(text: string, keyword: string): boolean {
  const needle = normalizeText(keyword).trim();
  if (!needle) return false;
  return normalizeText(text).includes(needle);
}

/**
 * A hashtag "matches" a keyword when the tag contains the keyword with
 * spaces removed ("home workout" matches #homeworkout and #homeworkoutdaily).
 */
export function hashtagMatchesKeyword(tag: string, keyword: string): boolean {
  const needle = normalizeText(keyword).replace(/\s+/gu, "");
  if (!needle) return false;
  return normalizeText(tag).replace(/^#/u, "").includes(needle);
}

/** "quiet cardio" -> "quietcardio": the hashtag form of a keyword phrase. */
export function hashtagify(keyword: string): string {
  return normalizeText(keyword).replace(/\s+/gu, "");
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** "2.1M", "15.3K", "950" — for search-volume figures in fix hints. */
export function formatSearchVolume(volume: number): string {
  if (!Number.isFinite(volume) || volume <= 0) return "0";
  if (volume >= 1_000_000)
    return trimZero((volume / 1_000_000).toFixed(1)) + "M";
  if (volume >= 1_000) return trimZero((volume / 1_000).toFixed(1)) + "K";
  return String(Math.round(volume));
}

function trimZero(fixed: string): string {
  return fixed.replace(/\.0$/, "");
}
