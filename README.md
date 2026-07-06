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

Prerequisites: Node.js 20+, PostgreSQL 15+, Redis 7+ (local installs or Docker).

1. **Install dependencies**

   ```bash
   npm install
   ```

   This also runs `prisma generate` (postinstall).

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Adjust `DATABASE_URL` and `REDIS_URL` if your local PostgreSQL/Redis differ
   from the defaults. Quick start with Docker:

   ```bash
   docker run -d --name findable-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=findable -p 5432:5432 postgres:16
   docker run -d --name findable-redis -p 6379:6379 redis:7
   ```

3. **Sync the database schema** (once models exist)

   ```bash
   npx prisma migrate dev
   ```

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

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

## Project layout

```
app/          Routes (App Router). Server components by default.
lib/          Shared code.
  data/       Repository functions — the only place Prisma is used.
  scoring/    Pure-TypeScript business logic, unit-tested with Vitest.
  db.ts       Prisma client singleton.
  redis.ts    Redis client singleton.
messages/     next-intl translation files (en.json, vi.json, id.json).
prisma/       Prisma schema and migrations.
public/       Static assets.
```

See [CLAUDE.md](./CLAUDE.md) for project context and conventions.
