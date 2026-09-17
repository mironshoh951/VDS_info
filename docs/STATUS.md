# Build status

**Verified on every change:** `npm run typecheck`, `npm run lint`,
`npm test` and `npm run build` all pass with zero errors and zero warnings.
64 routes build cleanly.

---

## Run it

```bash
cd vds-platform
bash scripts/setup.sh      # checks tools, writes .env, starts services, migrates
npm run create-admin       # creates the first Super Admin account
npm run dev
```

- Public site → <http://localhost:3000>
- Admin → <http://localhost:3000/admin> (while `ADMIN_PATH_FALLBACK=true`)

If the setup script reports that Docker is unavailable, either open Docker
Desktop and run the script again, or use a local PostgreSQL instead:

```bash
bash scripts/use-local-postgres.sh   # Postgres.app or Homebrew, no Docker
```

Without a database the app fails with `role "vds" does not exist`. Redis is
optional in development — the app falls back to an in-process rate limiter and
logs a warning rather than refusing to sign anyone in.

For production, see [DEPLOYMENT.md](./DEPLOYMENT.md).

To load the development sample content:

```bash
npm run db:seed
```

It is safe to re-run: every step skips records that already exist, so it fills
gaps rather than overwriting anything entered since. That is how images and
contact details reach a database seeded before they were added.

Everything it creates is fictional and labelled as such — a banner stays at the
top of the admin panel until you clear it in Settings. That includes the parts
that look most real:

- **Images** are generated artwork, not photographs. The seed draws them from
  the site's palette rather than downloading stock imagery, so there is no
  third-party licence in the repository and no product shot belonging to a
  manufacturer this catalogue only pretends to stock.
- **Contact details** use numbers from an unallocated `+998 00` range and
  `example.com`, so none of them reaches anyone.
- **Figures** in the statistics band are round demo numbers. They are business
  claims and have to be replaced with true ones before launch.

---

## What is built

### Foundation

Next.js 16 · React 19 · TypeScript strict · Tailwind 4 · Prisma 7 + PostgreSQL
(pgvector) · Redis · BullMQ-ready worker · S3/MinIO · Docker Compose ·
GitHub Actions pipeline · validated environment that fails fast on boot.

### Database

~97 tables covering every entity in the specification: content with
translations, media, menus, forms, inquiries, AI/RAG tables, analytics, audit,
sessions and security. Soft delete, version snapshots and polymorphic SEO are
implemented as schema-wide patterns rather than per-table.

### Security

- Argon2id passwords, opaque server-side sessions, idle **and** absolute expiry
- Sessions bound to the host that issued them — an admin cookie is inert on the
  public host
- Two independent rate limiters on sign-in, account lockout, no account
  enumeration
- TOTP two-factor with a replay guard, plus single-use recovery codes
- Step-up re-authentication: scoped, single-use tokens for destructive actions
- CSRF via SameSite + origin check + signed double-submit token
- Nonce-based CSP, HSTS, `no-store`/`noindex` on the whole admin surface
- Append-only audit log with field-level diffs; refused actions are logged too
- Security centre: live sessions, sign-in history, events, MFA coverage

### Public website

Home, About and any other CMS page, Products (filterable catalogue + detail),
Partners (directory + profile), Brands, Services, Events, News, Resources,
Trust centre, Achievements, Contact, and global Search — all four languages,
all database-driven.

- Per-locale slugs, locale fallback per field, `hreflang`, canonical URLs
- JSON-LD for Organization, Product, Article, Event, FAQ and breadcrumbs
- `sitemap.xml` and `robots.txt` that stay closed until you enable indexing
- Working enquiry forms → stored inquiries → admin pipeline
- Structured rich text: there is no HTML string to sanitise, so stored XSS
  through the CMS is impossible by construction
- Company photography has two homes: a full-bleed background image on the hero
  block, and a photo-gallery block with a mosaic or even-row layout. Both render
  nothing until pictures are chosen — an empty frame captioned "our facilities"
  is worse than no section
- Light and dark themes with a header toggle. First visit follows the
  visitor's operating system; their choice is remembered in a cookie and
  applied by a pre-paint inline script, so there is no flash and the pages stay
  cached (`revalidate`) — see `src/lib/site-theme.ts`

### Administration

- Authenticated shell with capability-filtered navigation
- Dashboard with live counts and translation completeness
- List + edit screens for products, partners, brands, services, events, news,
  resources, certificates, achievements and pages — one shared implementation,
  so all ten behave identically
- Language tabs in the editor; editing the English source automatically marks
  the other three languages **outdated**
- Publish, unpublish, archive, feature, bulk actions, trash, restore, and
  permanent delete behind password confirmation
- Inquiries pipeline with statuses, internal notes and PII masking for
  read-only accounts
- Translation completeness matrix per content type and language
- Settings: company, languages, contact, SEO, maintenance, privacy, security,
  AI routing and budget
- Users: create, change role, suspend, reset password, delete — every one
  audited and behind password confirmation, and the system refuses to leave
  itself without an active Super Admin
- Audit log and Security centre
- Media library: upload with `sharp`-generated webp variants, alt text, soft
  delete, and a picker wired into every image and document field
- Galleries for products, partners and events, with ordering and a primary
  image, saved as you go rather than with the form
- Menu editor, category manager, analytics screens and search-term reports
- Page section editor: add, reorder, hide and delete the blocks a page is built
  from, with configuration and per-language text separated the way the schema
  stores them
- Interface language (Uzbek by default) and a light/dark toggle, both stored
  per operator in a cookie and resolved server-side so the first paint is
  already correct
- Settings save as one group behind a single password prompt, rather than
  asking once per field
- AI translation: drafts the other three languages from the Uzbek source,
  marked `AI_DRAFT` so nothing reaches the public site before a person approves
  it. Every call is priced into a spend ledger with a monthly cap.

---

## Not built yet

| Area             | Notes                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Public assistant | The retrieval-augmented chat on the site itself. Needs either an embedding provider or the search-backed fallback wired to the chat surface.  |
| Import/export    | Not started.                                                                                                                                  |
| E2E tests        | Smoke suites cover the public site, theming and admin sign-in. The authenticated admin tests need `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`. |

---

## Known environment notes

- **No `prisma/migrations` folder is committed.** The sandbox this was written
  in cannot download Prisma's engine binary, so the first migration is created
  on your machine by `scripts/setup.sh` (or `npx prisma migrate dev --name init`).
  The schema itself is validated and correct.
- **`docs/ci-workflow.yml`** must be copied to `.github/workflows/ci.yml` by
  hand — GitHub blocks remote writes to workflow files.
- Public pages are rendered on demand and cached (`revalidate`), not prerendered
  at build time. That keeps `next build` independent of a running database,
  which matters for CI. It is also why the public theme is applied by a
  script rather than read from a cookie during render: one `cookies()` call in
  the shared layout would opt every page out of that cache.
- **The source language is Uzbek.** `DEFAULT_LOCALE` in `src/i18n/config.ts` is
  what the editor demands a title in, what `sourceHash` is measured against, and
  what the public site falls back to. The stored `site.i18n.defaultLocale`
  setting has to agree with it — a unit test checks the defaults match, but a
  database seeded before the change keeps its old value until it is changed in
  Settings → Languages.
- **AI models are not constants.** Groq withdrew `llama-3.3-70b-versatile` in
  August 2026. Run `npm run ai:check` to see which chat models a key can use and
  to test the configured one. A model name that is wrong — or that names a
  speech or moderation model rather than a chat model — is reported with the
  usable alternatives listed.
- **Media storage.** `MEDIA_DRIVER=local` (the default) writes to
  `MEDIA_LOCAL_DIR` and serves through the `/media/*` route handler. The `S3_*`
  settings are ignored until the driver is set to `s3`, which is not
  implemented yet and fails loudly rather than silently writing to disk.
- **After editing `THEME_INIT_SCRIPT`** in `src/lib/site-theme.ts`, run
  `npm run theme:hash`. The Content-Security-Policy admits that script by hash;
  if the two drift, the browser refuses to run it and the site is stuck on light
  with nothing in the interface to explain why. The unit test catches it.
