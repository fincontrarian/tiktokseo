"use server";

import { requireSession } from "@/lib/auth";
import { trackKeyword } from "@/lib/data";

export interface TrackState {
  tracked: boolean;
  limited?: boolean;
}

export async function trackKeywordAction(
  _prev: TrackState,
  formData: FormData,
): Promise<TrackState> {
  const keywordId = String(formData.get("keywordId") ?? "");
  if (!keywordId) return { tracked: false };

  const session = await requireSession();
  const result = await trackKeyword(session.userId, keywordId, session.plan);
  if (result === "limit") return { tracked: false, limited: true };
  return { tracked: true };
}
