import { cache } from "react";
import { getCreatorAuditData, getNicheBenchmarks } from "@/lib/data";
import { computeAuditScore } from "@/lib/scoring";
import type { AuditResult, CreatorRecord } from "@/lib/scoring";

/** Cookie that unlocks the full check list after a lead is captured. */
export const UNLOCK_COOKIE = "fd_report";

export interface LoadedAudit {
  creator: CreatorRecord;
  niche: string;
  result: AuditResult;
}

/**
 * Look up a creator and score them. Deduped per request via React cache so
 * the page, generateMetadata, and the OG image share one set of queries.
 * Returns null when the handle is not in our index.
 */
export const loadAudit = cache(
  async (handle: string): Promise<LoadedAudit | null> => {
    const data = await getCreatorAuditData(handle);
    if (!data) return null;

    const benchmarks = await getNicheBenchmarks(data.niche);
    const result = computeAuditScore({
      creator: data.creator,
      videos: data.videos,
      benchmarks,
    });
    return { creator: data.creator, niche: data.niche, result };
  },
);
