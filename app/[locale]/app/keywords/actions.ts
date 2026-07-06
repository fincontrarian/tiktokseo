"use server";

import { cookies } from "next/headers";
import { getSession, PLAN_COOKIE } from "@/lib/auth";
import { trackKeyword } from "@/lib/data";

export interface TrackState {
  tracked: boolean;
}

export async function trackKeywordAction(
  _prev: TrackState,
  formData: FormData,
): Promise<TrackState> {
  const keywordId = String(formData.get("keywordId") ?? "");
  if (!keywordId) return { tracked: false };

  const session = await getSession();
  await trackKeyword(session.userId, keywordId);
  return { tracked: true };
}

/** DEV ONLY — simulates the plan until real auth/billing ships. */
export async function setDevPlanAction(formData: FormData): Promise<void> {
  const plan = formData.get("plan") === "paid" ? "paid" : "free";
  const jar = await cookies();
  jar.set(PLAN_COOKIE, plan, { path: "/", sameSite: "lax" });
}
