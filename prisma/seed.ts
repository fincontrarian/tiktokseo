/**
 * Development/E2E seed. Idempotent: safe to re-run.
 *
 * In production these tables are populated by the internal ingestion
 * pipeline; this seed only exists so local dev and E2E tests have a
 * realistic slice of the index to read.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
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

  console.log("Seed complete: 2 creators, fitness benchmarks + keywords.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
