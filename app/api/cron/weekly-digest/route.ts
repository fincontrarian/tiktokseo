import { NextResponse } from "next/server";
import { composeWeeklyDigests } from "@/lib/data";

/**
 * Weekly digest cron. Composes (does NOT send) a per-user summary of deltas
 * for every tracked profile and stores it in the digests table — sending is
 * a later prompt. Point a scheduler (e.g. Vercel Cron) at this route weekly.
 *
 * When CRON_SECRET is set, requests must carry it as a bearer token.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const result = await composeWeeklyDigests();
  return NextResponse.json(result);
}
