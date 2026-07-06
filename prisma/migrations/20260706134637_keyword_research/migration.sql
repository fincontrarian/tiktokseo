-- CreateTable
CREATE TABLE "VideoHashtag" (
    "videoId" TEXT NOT NULL,
    "hashtag" TEXT NOT NULL,

    CONSTRAINT "VideoHashtag_pkey" PRIMARY KEY ("videoId","hashtag")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "locale" TEXT NOT NULL,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordStatDaily" (
    "id" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "videoCount" INTEGER NOT NULL,
    "totalViews" BIGINT NOT NULL,

    CONSTRAINT "KeywordStatDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedKeyword" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoHashtag_hashtag_idx" ON "VideoHashtag"("hashtag");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_locale_term_key" ON "Keyword"("locale", "term");

-- CreateIndex
CREATE INDEX "KeywordStatDaily_keywordId_date_idx" ON "KeywordStatDaily"("keywordId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "KeywordStatDaily_keywordId_date_key" ON "KeywordStatDaily"("keywordId", "date");

-- CreateIndex
CREATE INDEX "TrackedKeyword_userId_idx" ON "TrackedKeyword"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedKeyword_userId_keywordId_key" ON "TrackedKeyword"("userId", "keywordId");

-- AddForeignKey
ALTER TABLE "VideoHashtag" ADD CONSTRAINT "VideoHashtag_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordStatDaily" ADD CONSTRAINT "KeywordStatDaily_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedKeyword" ADD CONSTRAINT "TrackedKeyword_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
