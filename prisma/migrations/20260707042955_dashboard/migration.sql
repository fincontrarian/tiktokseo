-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "CreatorStatDaily" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "followerCount" INTEGER NOT NULL,
    "avgViewsPerVideo" DOUBLE PRECISION NOT NULL,
    "engagementRate" DOUBLE PRECISION NOT NULL,
    "saveRate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CreatorStatDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditSnapshot" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Digest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Digest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreatorStatDaily_creatorId_date_idx" ON "CreatorStatDaily"("creatorId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CreatorStatDaily_creatorId_date_key" ON "CreatorStatDaily"("creatorId", "date");

-- CreateIndex
CREATE INDEX "TrackedProfile_userId_idx" ON "TrackedProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedProfile_userId_creatorId_key" ON "TrackedProfile"("userId", "creatorId");

-- CreateIndex
CREATE INDEX "ProfileEvent_userId_creatorId_date_idx" ON "ProfileEvent"("userId", "creatorId", "date");

-- CreateIndex
CREATE INDEX "AuditSnapshot_creatorId_createdAt_idx" ON "AuditSnapshot"("creatorId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Digest_userId_weekStart_key" ON "Digest"("userId", "weekStart");

-- AddForeignKey
ALTER TABLE "CreatorStatDaily" ADD CONSTRAINT "CreatorStatDaily_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedProfile" ADD CONSTRAINT "TrackedProfile_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileEvent" ADD CONSTRAINT "ProfileEvent_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSnapshot" ADD CONSTRAINT "AuditSnapshot_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
