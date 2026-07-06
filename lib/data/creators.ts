import { prisma } from "@/lib/db";
import type { CreatorRecord, VideoRecord } from "@/lib/scoring";

export interface CreatorAuditData {
  creator: CreatorRecord;
  niche: string;
  videos: VideoRecord[];
}

/**
 * Load a creator and their 30 most recent videos from our index.
 * Returns null when the handle is not in the index yet.
 */
export async function getCreatorAuditData(
  handle: string,
): Promise<CreatorAuditData | null> {
  const creator = await prisma.creator.findUnique({
    where: { handle },
    include: {
      videos: { orderBy: { postedAt: "desc" }, take: 30 },
    },
  });
  if (!creator) return null;

  return {
    creator: {
      handle: creator.handle,
      displayName: creator.displayName,
      bio: creator.bio,
      followerCount: creator.followerCount,
    },
    niche: creator.niche,
    videos: creator.videos.map((video) => ({
      caption: video.caption,
      hashtags: video.hashtags,
      postedAt: video.postedAt,
      stats: {
        views: video.views,
        likes: video.likes,
        comments: video.comments,
        bookmarks: video.bookmarks,
      },
    })),
  };
}
