# Findable

TikTok SEO platform for creators and agencies: audit profiles and content,
optimize for TikTok search, and track ranking results daily.

Findable is an independent analytics platform and is not affiliated with,
endorsed by, or sponsored by TikTok or ByteDance Ltd.

## Stack

- [Next.js 15](https://nextjs.org) (App Router, TypeScript, server components)
- [Tailwind CSS 4](https://tailwindcss.com)
- [PostgreSQL](https://www.postgresql.org) via [Prisma](https://www.prisma.io)
- [Redis](https://redis.io) (ioredis) for caching
- [next-intl](https://next-intl.dev) for i18n — `en` (default, at root), `vi`, `id`
- [Vitest](https://vitest.dev) for unit tests
- Deployed on [Vercel](https://vercel.com) (Redis via a managed provider, e.g. Upstash)

## Local setup

Prerequisites: Node.js 20+ and Docker (for PostgreSQL + Redis).

### Quickstart (4 commands)

```bash
docker compose up -d          # starts PostgreSQL + Redis
cp .env.example .env          # default values already point at the containers
npm install                   # deps (+ prisma generate)
npm run setup                 # applies migrations and seeds demo data
npm run dev                   # http://localhost:3000
```

Then open **[http://localhost:3000](http://localhost:3000)**. A guided tour of
every page is in [`docs/demo-tour.md`](./docs/demo-tour.md).

The seed loads three demo creators (`lanmoves`, `quietcardio`, `fitarchive`)
with 12 months of daily history, fitness keywords across en/vi/id, and prior
audit snapshots — so every feature works with realistic data out of the box.

> No Docker? Install PostgreSQL 15+ and Redis 7+ yourself, create a `findable`
> database, then run the same `npm install`, `npm run setup`, `npm run dev`.

### Auth & billing in development

- **Sign-in** is passwordless (email magic link) plus optional Google OAuth
  (set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` to enable the button). With
  no `RESEND_API_KEY` configured, magic links are printed to the dev-server
  console and can be fetched from `/api/dev/magic-link?email=...` (dev/E2E
  only — the route 404s in production).
- **Billing** talks to [stripe-mock](https://github.com/stripe/stripe-mock)
  locally instead of Stripe. Build it once with
  `GOBIN=$PWD/.bin go install github.com/stripe/stripe-mock@latest` and the
  test suites start it themselves; `.env` points `STRIPE_API_BASE` at it.
  Checkout completion is simulated by a signed webhook through the real
  `/api/webhooks/stripe` handler, so the production path is exercised end
  to end. In production, unset `STRIPE_API_BASE` and set real
  `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` values.
- The app-shell **plan switcher** (dev/E2E only) writes a real subscription
  row, so entitlements always flow through `getUserPlan()`.

## Scripts

| Command                | What it does                     |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start the dev server (Turbopack) |
| `npm run build`        | Production build                 |
| `npm start`            | Serve the production build       |
| `npm run lint`         | ESLint                           |
| `npm run format`       | Prettier (write)                 |
| `npm run format:check` | Prettier (check only)            |
| `npm run typecheck`    | TypeScript, no emit              |
| `npm test`             | Vitest unit tests (single run)   |
| `npm run test:watch`   | Vitest in watch mode             |
| `npm run test:e2e`     | Playwright E2E (needs seeded DB) |
| `npm run db:seed`      | Seed demo creators + benchmarks  |

## Project layout

```
app/          Routes (App Router, /[locale] segment). Server components by default.
components/   Shared UI (nav, footer, score dial, forms).
e2e/          Playwright end-to-end tests.
i18n/         next-intl routing/request config (en at root, /vi, /id).
lib/          Shared code.
  data/       Repository functions — the only place Prisma is used.
  scoring/    Pure-TypeScript business logic, unit-tested with Vitest.
  audit.ts    Request-cached audit loader (data + scoring).
  db.ts       Prisma client singleton.
  redis.ts    Redis client singleton.
  rate-limit.ts  Redis fixed-window rate limiter.
messages/     next-intl translation files (en.json, vi.json, id.json).
prisma/       Prisma schema, migrations, and dev/E2E seed.
public/       Static assets.
```

See [CLAUDE.md](./CLAUDE.md) for project context and conventions.
