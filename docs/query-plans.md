# Query plans — keyword research

The two heaviest queries behind `/app/keywords`, with `EXPLAIN (ANALYZE,
BUFFERS)` output from the seeded dev database and notes on how they behave at
index scale (~100k keywords per locale, tens of millions of video-hashtag
rows). Both queries sit behind the Redis read-through cache
(`lib/cache.ts`) with the TTL chosen by the recency gate: **5 min on the
paid tier, 24 h on the free tier**, so Postgres sees at most one execution
per distinct (filters × tier × day) tuple per TTL window.

## 1. Keyword list with growth windows (`lib/data/keywords.ts` → `loadKeywords`)

Shape: for every keyword in a locale, one `JOIN LATERAL ... ORDER BY date
DESC LIMIT 1` probe for the snapshot at `asOf`, plus two more for the 7d/30d
comparison points; `NTILE(3)` over the locale for the competition tercile;
then filter, sort, paginate.

Key lines from the dev plan (10 en keywords × 75 daily rows):

```
Nested Loop (actual rows=10)
  Bitmap Index Scan on "Keyword_locale_term_key" (locale = 'en')
  -> Limit 1 — Index Scan Backward using "KeywordStatDaily_keywordId_date_key"
       Index Cond: ("keywordId" = k.id AND date <= now())            [cur]
  -> Limit 1 — Index Scan Backward ... (date <= now() - '7 days')    [w7]
  -> Limit 1 — Index Scan Backward ... (date <= now() - '30 days')   [w30]
Planning Time: 0.864 ms
Execution Time: 0.434 ms
```

Why this scales:

- Each lateral is a **single backward index probe** on the composite unique
  index `(keywordId, date)` — `LIMIT 1` stops after the first match, so cost
  per keyword is O(log n) regardless of history length. No per-keyword sort,
  no sequential scan of the stats table.
- The locale filter hits `Keyword_locale_term_key` (locale is the leading
  column), so prefix search (`term ILIKE 'x%'`) can use the same index.

What to watch at 100k keywords/locale:

- `NTILE(3) OVER (ORDER BY video_count)` forces materializing the whole
  locale before pagination (~100k × 3 index probes per cache miss). The
  cache absorbs this today; when it stops being enough, precompute the
  tercile into a denormalized column during ingestion (it only changes
  daily) and the query becomes probe + sort + limit.
- `OFFSET` pagination degrades on deep pages; switch to keyset pagination
  (`WHERE (sort_col, term) > (last_seen)`) if users page far.

## 2. Related hashtags co-occurrence (`lib/data/keywords.ts` → `relatedHashtags`)

Shape: self-join of `VideoHashtag` on `videoId` for one anchor hashtag,
joined to `Video` for the recency cutoff, grouped and ranked by shared
video count.

Key lines from the dev plan:

```
Hash Join (VideoHashtag vh2 ⋈ vh1(hashtag = 'homeworkout') ⋈ Video)
  Filter: ("postedAt" <= now())
Planning Time: 0.924 ms
Execution Time: 0.380 ms
```

At dev scale the planner picks seq scans (154 rows total — cheaper than the
index). At real scale it flips to:

- `VideoHashtag_hashtag_idx` to find the anchor rows (`vh1.hashtag = $tag`),
- the `(videoId, hashtag)` primary key for the co-occurrence probe per
  video,
- `Video` PK lookup per matched video for the `postedAt` cutoff.

Cost is proportional to **videos carrying the anchor tag × avg tags per
video**, not to the size of the table. For mega-tags (millions of videos)
that's still a large fanout; the mitigations, in order:

1. The per-tag Redis cache (already in place — key is
   `kw:related:v1:{tag}:{asOfDay}`, so one computation per tag per day per
   tier window).
2. Cap the anchor scan with a recency window (e.g. only videos from the
   last 90 days) — co-occurrence is a trend signal, old videos add little.
3. If needed, precompute a `hashtag_cooccurrence` rollup in the ingestion
   pipeline and reduce this to a single index read.

## Supporting indexes (see prisma/schema.prisma)

| Index                                              | Serves                                          |
| -------------------------------------------------- | ----------------------------------------------- |
| `KeywordStatDaily (keywordId, date DESC)` (unique) | all three lateral probes + sparkline range read |
| `Keyword (locale, term)` (unique)                  | locale filter, prefix search, autocomplete      |
| `VideoHashtag (videoId, hashtag)` PK               | co-occurrence probe                             |
| `VideoHashtag (hashtag)`                           | anchor-tag lookup                               |
| `TrackedKeyword (userId, keywordId)` (unique)      | tracked-state reads/upserts                     |
