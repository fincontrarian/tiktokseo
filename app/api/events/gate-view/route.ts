import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logGateEvent } from "@/lib/data";

export const dynamic = "force-dynamic";

const GATE_RE = /^[a-z0-9-]{1,64}$/;
const LOCALES = new Set(["en", "vi", "id"]);

/**
 * Pricing-view beacon: fired client-side when /pricing loads with ?from=,
 * so the (static) pricing page stays static while attribution still lands
 * in the events table.
 */
export async function POST(request: Request) {
  let body: { from?: string; locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const from = String(body.from ?? "");
  if (!GATE_RE.test(from)) {
    return NextResponse.json({ error: "bad gate" }, { status: 400 });
  }
  const session = await getSession();
  await logGateEvent({
    userId: session?.userId,
    gate: from,
    kind: "pricing-view",
    path: "/pricing",
    locale: LOCALES.has(String(body.locale)) ? String(body.locale) : "en",
  });
  return NextResponse.json({ ok: true });
}
