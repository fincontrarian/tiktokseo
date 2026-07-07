# Demo tour

Every page in the app, with what to click. After `npm run setup && npm run dev`,
start at [http://localhost:3000](http://localhost:3000).

The seed loads three demo creators — **`lanmoves`** (growing followers but
declining engagement — a mixed audit), **`quietcardio`** (everything trending
up — the A-grade showcase), and **`fitarchive`** (a dormant archive account).

## Public marketing

| URL        | What to see                                                        |
| ---------- | ------------------------------------------------------------------ |
| `/`        | Landing page. Try the language links in the footer → `/vi`, `/id`. |
| `/pricing` | Pricing (plans coming soon).                                       |

## Free audit (acquisition surface)

| URL                               | What to see                                                                                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/audit`                          | Enter `@lanmoves` and submit.                                                                                                                                                            |
| `/audit/lanmoves`                 | Animated score dial + grade, the two highest-priority fixes with exact advice, and the rest **blurred behind an email wall**. Enter any email to unlock the full report (sets a cookie). |
| `/audit/quietcardio`              | The A-grade version (higher score).                                                                                                                                                      |
| `/audit/ghost.handle_404`         | "Not in our index yet" → email lead-capture state.                                                                                                                                       |
| `/audit/lanmoves/opengraph-image` | The auto-generated social share image (handle + score + dial).                                                                                                                           |

## Authenticated app

The app area has a **dev plan switcher** in the top bar (Free / Creator / Pro)
that simulates the plan until real auth ships. Use it to see how each tier
changes what's visible.

### Keyword research — `/app/keywords`

| Plan              | What to see                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Free**          | 3 rows, data 30 days old, growth shown as "Rising/Falling" bands, remaining rows blurred with an upgrade CTA, no export. |
| **Creator / Pro** | Fresh data, all rows, exact growth %, and a **Export CSV** button.                                                       |

Try the search box (autocomplete over real keywords), the Market filter
(`EN`/`VI`/`ID`), sortable columns, and click a keyword to load the
**Related hashtags** panel. "Track" persists the keyword.

### Dashboard — `/app/dashboard`

1. On **Free** with nothing tracked yet, remove the tracked profile (the `×`
   on its chip) to see the **empty state**.
2. Add `lanmoves`. The wow moment: **12 months of history render instantly**
   with a "we've been indexing this profile since …" caption — the data
   predates signup because it comes from our index.
3. Four charts (followers, avg views/video, engagement rate, save rate).
4. **Log a change** in the change log (e.g. "Changed bio") — it appears as a
   dashed vertical marker on every chart.
5. **Latest audit** card shows score + delta vs the previous run; **Re-run
   audit** is rate-limited to 1/day on Free (switch to Pro for more).
6. Switch to **Pro** (limit 5) and add `quietcardio` to track multiple
   profiles; **Free/Creator** cap at 1 and show an upgrade notice.

## Weekly digest cron (stub)

```bash
curl http://localhost:3000/api/cron/weekly-digest
```

Composes a per-user summary of weekly deltas for every tracked profile and
stores it in the `digests` table (email sending ships later). Inspect it:

```bash
docker exec -it findable-pg psql -U postgres findable -c \
  'SELECT subject, left(body, 400) FROM "Digest" ORDER BY "createdAt" DESC LIMIT 1;'
```
