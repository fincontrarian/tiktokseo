import { NextResponse } from "next/server";
import { suggestKeywords } from "@/lib/data";
import type { KeywordLocale } from "@/lib/keywords/gate";

const LOCALES: KeywordLocale[] = ["en", "vi", "id"];

/** Prefix autocomplete for the keyword search box. Locale-aware. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const localeParam = url.searchParams.get("locale") ?? "en";
  const locale = LOCALES.includes(localeParam as KeywordLocale)
    ? (localeParam as KeywordLocale)
    : "en";

  if (q.trim().length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await suggestKeywords(q, locale);
  return NextResponse.json(
    { suggestions },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
