# VDS Dental Platform

A multilingual corporate platform for an international dental products company:
corporate website, partner and brand directories, product catalogue, services,
events, publishing, resource centre, trust centre, CMS, secure administration,
search, lead management, analytics, SEO infrastructure and two AI assistants.

**Architecture:** see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — read it first.

---

## Quick start (development)

```bash
cp .env.example .env          # then fill in the secrets
docker compose up -d postgres redis minio minio-init
npm install
npx prisma migrate dev
npm run db:seed               # development seed data, clearly labelled
npm run dev                   # public site  → http://localhost:3000
                              # admin        → http://admin.localhost:3000
```

`admin.localhost` resolves to 127.0.0.1 in most browsers. If yours does not,
add `127.0.0.1 admin.localhost` to `/etc/hosts`, or set
`ADMIN_PATH_FALLBACK=true` and use `http://localhost:3000/admin`.

Run the background worker in a second terminal:

```bash
npm run worker
```

## Full stack in Docker

```bash
docker compose --profile full up --build
```

## Commands

| Command                       | Purpose                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `npm run dev`                 | Development server                                            |
| `npm run build` / `npm start` | Production build and run                                      |
| `npm run worker`              | Background job worker (translations, indexing, images, email) |
| `npm run typecheck`           | TypeScript, strict, zero errors required                      |
| `npm run lint`                | ESLint including architectural boundary rules                 |
| `npm test`                    | Unit + integration tests                                      |
| `npm run test:e2e`            | Playwright end-to-end tests                                   |
| `npm run db:migrate`          | Create and apply a migration                                  |
| `npm run db:deploy`           | Apply migrations (production)                                 |
| `npm run db:seed`             | Load development seed data                                    |
| `npm run db:studio`           | Prisma Studio                                                 |

## Repository layout

```
src/
  app/                  routing and rendering only
    (public)/[locale]/  public website
    (admin)/            administration (separate host)
    api/                route handlers
  server/
    modules/<domain>/   use-cases, repositories, validation
    auth/               sessions, MFA, step-up, guards
    ai/                 provider adapter, RAG, prompts, guards
    jobs/               queues and processors
    security/           rate limiting, CSRF, headers, audit
    db/                 Prisma client, extensions, transactions
  components/           UI (never imports from server/)
  lib/                  pure utilities
  i18n/                 locale config and request setup
  styles/               design tokens and global CSS
prisma/                 schema, migrations, seed
messages/               UI string catalogues (uz, ru, en, zh)
docs/                   architecture and operations
tests/                  unit, integration, e2e
```

## Non-negotiable rules

1. Every mutation goes through a use-case in `server/modules/**` that begins
   with an authorization check. Frontend hiding is cosmetic only.
2. No business content is hardcoded — partners, products, statistics, menus,
   social links, contact details and claims all live in the database.
3. AI never publishes. AI output is a draft until a human approves it.
4. Secrets live in the environment, never in source or in the database in
   plaintext.
5. Seed data is development-only and is visibly labelled as such.
