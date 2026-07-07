-- CreateTable
CREATE TABLE "SitemapFile" (
    "name" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "urlCount" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitemapFile_pkey" PRIMARY KEY ("name")
);
