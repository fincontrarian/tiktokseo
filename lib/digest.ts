/**
 * Weekly digest composition. Pure TypeScript, no framework imports: the data
 * layer collects the numbers, this module turns them into the digest text.
 * (Email SENDING is a later prompt — for now digests are stored, not sent.)
 */

export interface ProfileDigestInput {
  handle: string;
  followers: { start: number; end: number };
  avgViews: { start: number; end: number };
  engagementRate: { start: number; end: number };
  saveRate: { start: number; end: number };
  latestAuditScore: number | null;
}

export interface ComposedDigest {
  subject: string;
  body: string;
}

/** Signed percent change; null when the starting value is 0. */
export function percentChange(start: number, end: number): number | null {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === 0) {
    return null;
  }
  return (end - start) / start;
}

function formatPct(change: number | null): string {
  if (change === null) return "n/a";
  const pct = change * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/** Start of the current week (Monday, UTC) — digest idempotency key. */
export function weekStartUtc(now: Date): Date {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const day = start.getUTCDay(); // 0 = Sunday
  const sinceMonday = (day + 6) % 7;
  start.setUTCDate(start.getUTCDate() - sinceMonday);
  return start;
}

export function composeDigest(
  profiles: ProfileDigestInput[],
  weekStart: Date,
): ComposedDigest {
  const week = weekStart.toISOString().slice(0, 10);
  const subject =
    profiles.length === 1
      ? `Your week on TikTok search: @${profiles[0].handle}`
      : `Your week on TikTok search: ${profiles.length} profiles`;

  const sections = profiles.map((profile) => {
    const lines = [
      `@${profile.handle}`,
      `  Followers: ${formatCount(profile.followers.end)} (${formatPct(percentChange(profile.followers.start, profile.followers.end))} this week)`,
      `  Avg views/video: ${formatCount(profile.avgViews.end)} (${formatPct(percentChange(profile.avgViews.start, profile.avgViews.end))})`,
      `  Engagement rate: ${formatRate(profile.engagementRate.end)} (${formatPct(percentChange(profile.engagementRate.start, profile.engagementRate.end))})`,
      `  Save rate: ${formatRate(profile.saveRate.end)} (${formatPct(percentChange(profile.saveRate.start, profile.saveRate.end))}) — our lead signal`,
    ];
    if (profile.latestAuditScore !== null) {
      lines.push(`  Latest audit score: ${profile.latestAuditScore}/100`);
    }
    return lines.join("\n");
  });

  const body = [
    `Week of ${week}`,
    "",
    ...sections,
    "",
    "Findable is an independent analytics platform and is not affiliated with, endorsed by, or sponsored by TikTok or ByteDance Ltd.",
  ].join("\n\n");

  return { subject, body };
}
