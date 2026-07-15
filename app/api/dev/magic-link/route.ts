import { NextResponse } from "next/server";
import { magicLinkKey } from "@/lib/nextauth";
import { redis } from "@/lib/redis";

/**
 * DEV/E2E ONLY — returns the latest magic link for an email so tests and
 * local development can sign in without an inbox. 404s in production.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" && !process.env.E2E_TEST_MODE) {
    return new Response("Not found", { status: 404 });
  }
  const email = new URL(request.url).searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }
  const url = await redis.get(magicLinkKey(email));
  if (!url) {
    return NextResponse.json({ error: "no link" }, { status: 404 });
  }
  return NextResponse.json({ url });
}
