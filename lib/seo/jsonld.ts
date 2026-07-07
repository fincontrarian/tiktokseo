/**
 * JSON-LD builders for public pages. Pure TypeScript.
 * https://developers.google.com/search/docs/appearance/structured-data/profile-page
 */

export interface CreatorJsonLdInput {
  url: string;
  name: string;
  handle: string;
  bio: string;
  followerCount: number;
  totalLikes: number;
  firstSeenAt: Date;
}

export function buildCreatorJsonLd(input: CreatorJsonLdInput): string {
  const data = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    dateCreated: input.firstSeenAt.toISOString(),
    url: input.url,
    mainEntity: {
      "@type": "Person",
      name: input.name,
      alternateName: `@${input.handle}`,
      identifier: input.handle,
      description: input.bio,
      interactionStatistic: [
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/FollowAction",
          userInteractionCount: input.followerCount,
        },
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/LikeAction",
          userInteractionCount: input.totalLikes,
        },
      ],
    },
  };
  return JSON.stringify(data);
}
