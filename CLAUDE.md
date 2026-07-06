# Findable — TikTok SEO Platform

## What this is
SaaS that helps TikTok creators and agencies optimize profiles/content to rank
in TikTok search. Two audiences: B2C creators, B2B agencies. Core loop:
audit -> optimize -> track results daily.

## Data asset (critical context)
We have a proprietary index: ~75M TikTok videos and ~25M creator profiles with
HISTORICAL engagement stats (views, likes, comments, bookmarks/saves over time).
Data arrives via an internal ingestion pipeline into Postgres tables — this
codebase READS that data, it never collects it. NEVER reference scraping,
scrapers, or collection methods anywhere: not in code comments, not in copy,
not in API names. Public framing is always "our index, refreshed daily."

## Hard rules
- We store metadata only (captions, hashtags, counts, URLs, public profile
  fields). Never download, store, or process video files.
- Brand/legal: never present "TikTok" as part of our brand. Footer of every
  page carries: "Findable is an independent analytics platform and is not
  affiliated with, endorsed by, or sponsored by TikTok or ByteDance Ltd."
- i18n from day one: en (default), vi, id. All user-facing strings through
  next-intl. URL pattern: /{locale}/...  (en at root without prefix).
- Key metrics language: engagement rate over follower count; bookmark/save
  velocity is our differentiating signal.
- Monetization: recency gating. Free tier sees top-3 results and data older
  than 30 days; paid tiers see fresh + full data.

## Code conventions
- Server components by default; client components only for interactivity.
- All DB access through /lib/data (repository functions), never inline Prisma
  in pages.
- Every scoring/business-logic module is pure TypeScript with unit tests
  (vitest), no framework imports.
- SEO is a first-class concern: every public page exports generateMetadata,
  pages are statically generated or ISR.
