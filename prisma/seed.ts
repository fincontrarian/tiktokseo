/**
 * Development/E2E seed. Idempotent: safe to re-run.
 *
 * In production these tables are populated by the internal ingestion
 * pipeline; this seed only exists so local dev and E2E tests have a
 * realistic slice of the index to read.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import Redis from "ioredis";
import { PrismaClient } from "../lib/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DAY = 24 * 60 * 60 * 1000;

const FITNESS_KEYWORDS: Array<[string, number]> = [
  ["home workout", 2_100_000],
  ["workout at home", 1_500_000],
  ["fat burning", 900_000],
  ["morning routine", 800_000],
  ["hiit for beginners", 400_000],
  ["no equipment workout", 350_000],
  ["apartment friendly workout", 120_000],
  ["dumbbell legs", 90_000],
  ["standing abs", 60_000],
  ["quiet cardio", 30_000],
];

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY);
}

interface SeedVideo {
  caption: string;
  hashtags: string[];
  postedAt: Date;
  views: number;
  likes: number;
  comments: number;
  bookmarks: number;
}

async function upsertCreator(
  data: {
    handle: string;
    displayName: string;
    bio: string;
    followerCount: number;
    niche: string;
    firstSeenAt?: Date;
  },
  videos: SeedVideo[],
) {
  const creator = await prisma.creator.upsert({
    where: { handle: data.handle },
    create: data,
    update: data,
  });
  // Videos have no natural key in the seed; replace wholesale for idempotency.
  await prisma.video.deleteMany({ where: { creatorId: creator.id } });
  await prisma.video.createMany({
    data: videos.map((v) => ({ ...v, creatorId: creator.id })),
  });
  return creator;
}

/**
 * Keyword seed set. slope: daily views trend (+ rising, - falling);
 * base: current daily total views scale; videos: current video count scale.
 */
interface SeedKeyword {
  term: string;
  locale: "en" | "vi" | "id";
  base: number;
  videos: number;
  slope: number;
}

const KEYWORDS: SeedKeyword[] = [
  {
    term: "home workout",
    locale: "en",
    base: 62_000_000,
    videos: 48_000,
    slope: 0.004,
  },
  {
    term: "workout at home",
    locale: "en",
    base: 41_000_000,
    videos: 36_500,
    slope: 0.002,
  },
  {
    term: "fat burning",
    locale: "en",
    base: 28_000_000,
    videos: 29_000,
    slope: -0.005,
  },
  {
    term: "morning routine",
    locale: "en",
    base: 24_500_000,
    videos: 22_000,
    slope: 0.0004,
  },
  {
    term: "hiit for beginners",
    locale: "en",
    base: 12_400_000,
    videos: 9_800,
    slope: 0.009,
  },
  {
    term: "no equipment workout",
    locale: "en",
    base: 10_100_000,
    videos: 8_100,
    slope: 0.003,
  },
  {
    term: "apartment friendly workout",
    locale: "en",
    base: 3_600_000,
    videos: 2_400,
    slope: 0.006,
  },
  {
    term: "dumbbell legs",
    locale: "en",
    base: 2_700_000,
    videos: 2_050,
    slope: -0.002,
  },
  {
    term: "standing abs",
    locale: "en",
    base: 1_900_000,
    videos: 1_500,
    slope: 0.008,
  },
  {
    term: "quiet cardio",
    locale: "en",
    base: 950_000,
    videos: 640,
    slope: 0.012,
  },
  {
    term: "bài tập tại nhà",
    locale: "vi",
    base: 18_500_000,
    videos: 15_200,
    slope: 0.007,
  },
  {
    term: "giảm mỡ bụng",
    locale: "vi",
    base: 14_800_000,
    videos: 12_400,
    slope: 0.005,
  },
  {
    term: "tập gym tại nhà",
    locale: "vi",
    base: 7_400_000,
    videos: 6_000,
    slope: 0.001,
  },
  {
    term: "yoga cho người mới",
    locale: "vi",
    base: 4_100_000,
    videos: 3_300,
    slope: 0.004,
  },
  {
    term: "cardio tại nhà",
    locale: "vi",
    base: 3_200_000,
    videos: 2_700,
    slope: -0.006,
  },
  {
    term: "ăn kiêng khoa học",
    locale: "vi",
    base: 2_100_000,
    videos: 1_650,
    slope: 0.002,
  },
  {
    term: "tập bụng 7 phút",
    locale: "vi",
    base: 1_300_000,
    videos: 990,
    slope: 0.01,
  },
  {
    term: "olahraga di rumah",
    locale: "id",
    base: 16_200_000,
    videos: 13_100,
    slope: 0.006,
  },
  {
    term: "diet sehat",
    locale: "id",
    base: 11_500_000,
    videos: 9_400,
    slope: 0.003,
  },
  {
    term: "latihan perut",
    locale: "id",
    base: 5_900_000,
    videos: 4_800,
    slope: 0.001,
  },
  {
    term: "kardio ringan",
    locale: "id",
    base: 2_800_000,
    videos: 2_200,
    slope: -0.007,
  },
  {
    term: "yoga pemula",
    locale: "id",
    base: 2_300_000,
    videos: 1_800,
    slope: 0.005,
  },
  {
    term: "workout tanpa alat",
    locale: "id",
    base: 1_700_000,
    videos: 1_300,
    slope: 0.009,
  },
  {
    term: "gerakan pemanasan",
    locale: "id",
    base: 900_000,
    videos: 700,
    slope: 0.0,
  },
];

const HISTORY_DAYS = 75;

/** Deterministic wobble so re-seeding is idempotent (no Math.random). */
function wobble(seed: number, day: number): number {
  return Math.sin(seed * 12.9898 + day * 0.61803) * 0.015;
}

async function seedKeywords() {
  for (const [index, kw] of KEYWORDS.entries()) {
    const keyword = await prisma.keyword.upsert({
      where: { locale_term: { locale: kw.locale, term: kw.term } },
      create: { locale: kw.locale, term: kw.term },
      update: {},
    });
    await prisma.keywordStatDaily.deleteMany({
      where: { keywordId: keyword.id },
    });
    const stats = Array.from({ length: HISTORY_DAYS }, (_, i) => {
      const age = HISTORY_DAYS - 1 - i; // days ago; last entry = today
      // Walk the trend back from today's base, plus deterministic noise.
      const trend = 1 / (1 + kw.slope * age);
      const noisy = trend * (1 + wobble(index + 1, age));
      const date = new Date(Date.now() - age * DAY);
      date.setUTCHours(0, 0, 0, 0);
      return {
        keywordId: keyword.id,
        date,
        videoCount: Math.max(1, Math.round(kw.videos * noisy)),
        totalViews: BigInt(Math.max(1, Math.round(kw.base * noisy))),
      };
    });
    await prisma.keywordStatDaily.createMany({ data: stats });
  }
}

/** Backfill the (video, hashtag) join table from Video.hashtags arrays. */
async function seedVideoHashtags() {
  await prisma.videoHashtag.deleteMany({});
  const videos = await prisma.video.findMany({
    select: { id: true, hashtags: true },
  });
  const rows = videos.flatMap((video) =>
    [...new Set(video.hashtags)].map((hashtag) => ({
      videoId: video.id,
      hashtag,
    })),
  );
  await prisma.videoHashtag.createMany({ data: rows });
}

/**
 * 12 months of daily profile stats per creator — the dashboard's wow moment
 * is that this history exists before the user ever signs up.
 */
interface StatCurve {
  handle: string;
  days: number;
  followersStart: number;
  followersEnd: number;
  avgViewsStart: number;
  avgViewsEnd: number;
  erStart: number;
  erEnd: number;
  saveStart: number;
  saveEnd: number;
}

const STAT_CURVES: StatCurve[] = [
  {
    // Steady growth, but ER and saves sliding — matches their weak audit.
    handle: "lanmoves",
    days: 365,
    followersStart: 9_800,
    followersEnd: 42_300,
    avgViewsStart: 6_500,
    avgViewsEnd: 13_500,
    erStart: 0.062,
    erEnd: 0.028,
    saveStart: 0.011,
    saveEnd: 0.004,
  },
  {
    // The A-grade showcase: everything trending up.
    handle: "quietcardio",
    days: 300,
    followersStart: 21_000,
    followersEnd: 128_500,
    avgViewsStart: 9_000,
    avgViewsEnd: 41_000,
    erStart: 0.048,
    erEnd: 0.064,
    saveStart: 0.009,
    saveEnd: 0.016,
  },
  {
    // Dormant archive account: slow decline.
    handle: "fitarchive",
    days: 365,
    followersStart: 22_400,
    followersEnd: 18_900,
    avgViewsStart: 11_000,
    avgViewsEnd: 8_400,
    erStart: 0.045,
    erEnd: 0.038,
    saveStart: 0.013,
    saveEnd: 0.011,
  },
];

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

async function seedCreatorStats() {
  for (const [index, curve] of STAT_CURVES.entries()) {
    const creator = await prisma.creator.findUnique({
      where: { handle: curve.handle },
    });
    if (!creator) continue;

    await prisma.creator.update({
      where: { id: creator.id },
      data: { firstSeenAt: daysAgo(curve.days) },
    });
    await prisma.creatorStatDaily.deleteMany({
      where: { creatorId: creator.id },
    });

    const rows = Array.from({ length: curve.days }, (_, i) => {
      const age = curve.days - 1 - i; // days ago; last row = today
      const t = i / (curve.days - 1);
      // Ease-in growth curve plus deterministic wobble.
      const progress = t * t * (3 - 2 * t);
      const noise = 1 + wobble(index + 10, age);
      const date = new Date(Date.now() - age * DAY);
      date.setUTCHours(0, 0, 0, 0);
      return {
        creatorId: creator.id,
        date,
        followerCount: Math.round(
          lerp(curve.followersStart, curve.followersEnd, progress) * noise,
        ),
        avgViewsPerVideo: Math.round(
          lerp(curve.avgViewsStart, curve.avgViewsEnd, progress) * noise,
        ),
        engagementRate: Number(
          (lerp(curve.erStart, curve.erEnd, progress) * noise).toFixed(4),
        ),
        saveRate: Number(
          (lerp(curve.saveStart, curve.saveEnd, progress) * noise).toFixed(4),
        ),
      };
    });
    await prisma.creatorStatDaily.createMany({ data: rows });
  }
}

/** Prior audit runs so the dashboard's score-delta card has history. */
async function seedAuditSnapshots() {
  const lanmoves = await prisma.creator.findUnique({
    where: { handle: "lanmoves" },
  });
  if (!lanmoves) return;
  await prisma.auditSnapshot.deleteMany({ where: { creatorId: lanmoves.id } });
  await prisma.auditSnapshot.createMany({
    data: [
      {
        creatorId: lanmoves.id,
        score: 58,
        grade: "F",
        createdAt: daysAgo(45),
      },
      {
        creatorId: lanmoves.id,
        score: 65,
        grade: "D",
        createdAt: daysAgo(12),
      },
    ],
  });
}

async function main() {
  await prisma.nicheBenchmark.upsert({
    where: { niche: "fitness" },
    create: {
      niche: "fitness",
      medianPostsPerWeek: 3,
      medianEngagementRate: 0.05,
      medianSaveRate: 0.01,
    },
    update: {
      medianPostsPerWeek: 3,
      medianEngagementRate: 0.05,
      medianSaveRate: 0.01,
    },
  });

  for (const [rank, [keyword, monthlyVolume]] of FITNESS_KEYWORDS.entries()) {
    await prisma.nicheKeyword.upsert({
      where: { niche_keyword: { niche: "fitness", keyword } },
      create: { niche: "fitness", keyword, monthlyVolume, rank: rank + 1 },
      update: { monthlyVolume, rank: rank + 1 },
    });
  }

  // Mixed-result creator: passes some checks, warns/fails others, so the
  // audit page shows visible fix hints AND the blurred wall.
  await upsertCreator(
    {
      handle: "lanmoves",
      displayName: "Lan | Home Workout Coach",
      bio: "HIIT for beginners, 5 days a week. DM for coaching.",
      followerCount: 42_300,
      niche: "fitness",
    },
    Array.from({ length: 14 }, (_, i) => ({
      caption:
        i % 2 === 0
          ? `Home workout for small spaces — day ${i + 1} 🔥 #homeworkout`
          : `POV: leg day 😅 #fyp #viral`,
      hashtags:
        i % 2 === 0
          ? ["homeworkout", "quietcardio", "fatburning", "standingabs"]
          : ["fyp", "viral"],
      postedAt: daysAgo(1 + i * 2),
      views: 12_000 + i * 500,
      likes: 260 + i * 10,
      comments: 18 + i,
      bookmarks: 40 + i, // save rate ~0.4% — below the 1% niche median
    })),
  );

  // Archive creator: older videos (35-90 days back) so recency-gated views
  // (free tier reads data >30 days old) still have hashtag co-occurrence.
  await upsertCreator(
    {
      handle: "fitarchive",
      displayName: "Fit Archive | Home Workout Library",
      bio: "Home workout and quiet cardio archive. Standing abs, fat burning, all of it.",
      followerCount: 18_900,
      niche: "fitness",
    },
    Array.from({ length: 12 }, (_, i) => ({
      caption: `Home workout classic #${i + 1} — still works 🔁`,
      hashtags: ["homeworkout", "quietcardio", "fatburning", "standingabs"],
      postedAt: daysAgo(35 + i * 5),
      views: 8_000 + i * 300,
      likes: 300 + i * 8,
      comments: 20 + i,
      bookmarks: 95 + i * 2,
    })),
  );

  // Fully optimized creator: the "A grade" showcase.
  await upsertCreator(
    {
      handle: "quietcardio",
      displayName: "Mai • Quiet Cardio & Home Workout",
      bio: "Home workout plans, quiet cardio for apartments, no equipment workout guides. New drops weekly.",
      followerCount: 128_500,
      niche: "fitness",
    },
    Array.from({ length: 16 }, (_, i) => ({
      caption: `Quiet cardio session ${i + 1}: home workout you can do at midnight 🤫`,
      hashtags: ["homeworkout", "quietcardio", "fatburning", "standingabs"],
      postedAt: daysAgo(1 + i * 1.8),
      views: 40_000 + i * 1_000,
      likes: 2_400 + i * 40,
      comments: 130 + i,
      bookmarks: 620 + i * 5, // save rate ~1.5% — above median
    })),
  );

  await seedKeywords();
  await seedVideoHashtags();
  await seedCreatorStats();
  await seedAuditSnapshots();

  // Reseeding changes what queries should return; drop the read-through cache.
  try {
    const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    await redis.flushdb();
    redis.disconnect();
    console.log("Cache flushed.");
  } catch {
    console.warn("Redis unavailable — skipped cache flush.");
  }

  console.log(
    `Seed complete: 3 creators, fitness benchmarks, ${KEYWORDS.length} keywords × ${HISTORY_DAYS}d stats, video hashtags.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
