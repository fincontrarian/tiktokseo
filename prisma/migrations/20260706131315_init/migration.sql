-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "followerCount" INTEGER NOT NULL,
    "niche" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "hashtags" TEXT[],
    "postedAt" TIMESTAMP(3) NOT NULL,
    "views" INTEGER NOT NULL,
    "likes" INTEGER NOT NULL,
    "comments" INTEGER NOT NULL,
    "bookmarks" INTEGER NOT NULL,
    "url" TEXT,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NicheKeyword" (
    "id" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "monthlyVolume" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "NicheKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NicheBenchmark" (
    "niche" TEXT NOT NULL,
    "medianPostsPerWeek" DOUBLE PRECISION NOT NULL,
    "medianEngagementRate" DOUBLE PRECISION NOT NULL,
    "medianSaveRate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "NicheBenchmark_pkey" PRIMARY KEY ("niche")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "handle" TEXT,
    "source" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Creator_handle_key" ON "Creator"("handle");

-- CreateIndex
CREATE INDEX "Creator_niche_idx" ON "Creator"("niche");

-- CreateIndex
CREATE INDEX "Video_creatorId_postedAt_idx" ON "Video"("creatorId", "postedAt" DESC);

-- CreateIndex
CREATE INDEX "NicheKeyword_niche_rank_idx" ON "NicheKeyword"("niche", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "NicheKeyword_niche_keyword_key" ON "NicheKeyword"("niche", "keyword");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_email_source_key" ON "Lead"("email", "source");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
