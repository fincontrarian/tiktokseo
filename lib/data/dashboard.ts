import { prisma } from "@/lib/db";
import { composeDigest, weekStartUtc } from "@/lib/digest";
import type { ProfileDigestInput } from "@/lib/digest";

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_MONTHS = 12;

export interface TrackedProfileSummary {
  id: string;
  creatorId: string;
  handle: string;
  displayName: string;
  followerCount: number;
  firstSeenAt: Date;
}

export interface DailyStatPoint {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  followers: number;
  avgViews: number;
  engagementRate: number;
  saveRate: number;
}

export interface ProfileEventItem {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  label: string;
  note: string | null;
}

export interface AuditSnapshotItem {
  score: number;
  grade: string;
  createdAt: Date;
}

// --- Tracked profiles ---------------------------------------------------------

export async function listTrackedProfiles(
  userId: string,
): Promise<TrackedProfileSummary[]> {
  const tracked = await prisma.trackedProfile.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { creator: true },
  });
  return tracked.map((item) => ({
    id: item.id,
    creatorId: item.creatorId,
    handle: item.creator.handle,
    displayName: item.creator.displayName,
    followerCount: item.creator.followerCount,
    firstSeenAt: item.creator.firstSeenAt,
  }));
}

export async function countTrackedProfiles(userId: string): Promise<number> {
  return prisma.trackedProfile.count({ where: { userId } });
}

/** Returns the creator id, or null when the handle is not in the index. */
export async function findCreatorIdByHandle(
  handle: string,
): Promise<string | null> {
  const creator = await prisma.creator.findUnique({
    where: { handle },
    select: { id: true },
  });
  return creator?.id ?? null;
}

export async function addTrackedProfile(
  userId: string,
  creatorId: string,
): Promise<void> {
  await prisma.trackedProfile.upsert({
    where: { userId_creatorId: { userId, creatorId } },
    create: { userId, creatorId },
    update: {},
  });
}

export async function removeTrackedProfile(
  userId: string,
  creatorId: string,
): Promise<void> {
  await prisma.trackedProfile.deleteMany({ where: { userId, creatorId } });
}

// --- History (the wow moment: predates signup) ---------------------------------

/** Up to 12 months of daily stats, oldest first. */
export async function getCreatorStatsSeries(
  creatorId: string,
): Promise<DailyStatPoint[]> {
  const since = new Date(Date.now() - HISTORY_MONTHS * 30 * DAY_MS);
  const rows = await prisma.creatorStatDaily.findMany({
    where: { creatorId, date: { gte: since } },
    orderBy: { date: "asc" },
  });
  return rows.map((row) => ({
    date: row.date.toISOString().slice(0, 10),
    followers: row.followerCount,
    avgViews: row.avgViewsPerVideo,
    engagementRate: row.engagementRate,
    saveRate: row.saveRate,
  }));
}

// --- Profile events (change-impact timeline) -----------------------------------

export async function listProfileEvents(
  userId: string,
  creatorId: string,
): Promise<ProfileEventItem[]> {
  const events = await prisma.profileEvent.findMany({
    where: { userId, creatorId },
    orderBy: { date: "asc" },
  });
  return events.map((event) => ({
    id: event.id,
    date: event.date.toISOString().slice(0, 10),
    label: event.label,
    note: event.note,
  }));
}

export async function addProfileEvent(input: {
  userId: string;
  creatorId: string;
  date: Date;
  label: string;
  note?: string;
}): Promise<void> {
  await prisma.profileEvent.create({
    data: {
      userId: input.userId,
      creatorId: input.creatorId,
      date: input.date,
      label: input.label,
      note: input.note ?? null,
    },
  });
}

// --- Audit snapshots ------------------------------------------------------------

/** Latest two snapshots (current + previous) for the delta card. */
export async function getLatestAuditSnapshots(
  creatorId: string,
): Promise<AuditSnapshotItem[]> {
  const snapshots = await prisma.auditSnapshot.findMany({
    where: { creatorId },
    orderBy: { createdAt: "desc" },
    take: 2,
  });
  return snapshots.map((s) => ({
    score: s.score,
    grade: s.grade,
    createdAt: s.createdAt,
  }));
}

export async function saveAuditSnapshot(
  creatorId: string,
  score: number,
  grade: string,
): Promise<void> {
  await prisma.auditSnapshot.create({ data: { creatorId, score, grade } });
}

// --- Weekly digest (stub: composed and stored, never sent) ----------------------

export interface DigestRunResult {
  usersProcessed: number;
  digestsWritten: number;
}

/**
 * Compose a weekly summary of deltas per tracked profile for every user who
 * tracks at least one profile, and store it in the digests table. Idempotent
 * per (user, weekStart).
 */
export async function composeWeeklyDigests(
  now: Date = new Date(),
): Promise<DigestRunResult> {
  const weekStart = weekStartUtc(now);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);

  const trackedByUser = await prisma.trackedProfile.groupBy({
    by: ["userId"],
  });

  let digestsWritten = 0;
  for (const { userId } of trackedByUser) {
    const profiles = await listTrackedProfiles(userId);
    const inputs: ProfileDigestInput[] = [];

    for (const profile of profiles) {
      const [startRow, endRow, latestAudit] = await Promise.all([
        prisma.creatorStatDaily.findFirst({
          where: { creatorId: profile.creatorId, date: { lte: weekAgo } },
          orderBy: { date: "desc" },
        }),
        prisma.creatorStatDaily.findFirst({
          where: { creatorId: profile.creatorId },
          orderBy: { date: "desc" },
        }),
        prisma.auditSnapshot.findFirst({
          where: { creatorId: profile.creatorId },
          orderBy: { createdAt: "desc" },
        }),
      ]);
      if (!endRow) continue;
      const start = startRow ?? endRow;
      inputs.push({
        handle: profile.handle,
        followers: {
          start: start.followerCount,
          end: endRow.followerCount,
        },
        avgViews: {
          start: start.avgViewsPerVideo,
          end: endRow.avgViewsPerVideo,
        },
        engagementRate: {
          start: start.engagementRate,
          end: endRow.engagementRate,
        },
        saveRate: { start: start.saveRate, end: endRow.saveRate },
        latestAuditScore: latestAudit?.score ?? null,
      });
    }
    if (inputs.length === 0) continue;

    const digest = composeDigest(inputs, weekStart);
    await prisma.digest.upsert({
      where: { userId_weekStart: { userId, weekStart } },
      create: {
        userId,
        weekStart,
        subject: digest.subject,
        body: digest.body,
      },
      update: { subject: digest.subject, body: digest.body },
    });
    digestsWritten += 1;
  }

  return { usersProcessed: trackedByUser.length, digestsWritten };
}
