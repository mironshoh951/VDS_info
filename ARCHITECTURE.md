# VDS Dental Platform — System Architecture (Phase 0)

**Document status:** Baseline architecture, pre-implementation
**Version:** 1.0
**Scope:** Corporate platform + CMS + product/partner/brand directories + events + publishing + resource centre + multilingual system + secure administration + AI assistants + search + leads + analytics + SEO + security/audit.

> **Naming note.** Throughout this document the product is referred to as *the Platform*. All company-specific names, figures, certifications, partners and claims are **content**, not code — they are entered through the CMS. Nothing in this architecture fabricates business facts.

---

## 0. Decisions locked before design

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Repository location | Connected folder on the owner's machine | Source of truth stays with the business. |
| D2 | Deployment target | Docker on a VPS/dedicated server | Required for a real background worker tier, Redis, object storage and predictable cost. Vercel-compatible fallback retained. |
| D3 | AI provider | Provider-agnostic adapter with **Anthropic** and **OpenAI** implementations, selectable per task from admin settings | No vendor lock-in; embeddings and chat can come from different vendors. |
| D4 | Admin separation | Separate subdomain `admin.<domain>` with host-scoped cookies and separate middleware; env-switchable to a path in local dev | Strongest practical isolation without a second codebase. |
| D5 | Languages | Exactly four: `uz`, `ru`, `en`, `zh`. Default configurable at runtime | Per requirement. Locale table is data, so a fifth locale is a row, not a release. |
| D6 | Roles | Exactly two: `SUPER_ADMIN`, `VIEWER` | Per requirement. Permission *capabilities* are modelled explicitly so a third role is additive, not a rewrite. |

---

## 1. High-level architecture

### 1.1 Runtime topology

```
                          ┌───────────────────────────────┐
        Internet ────────▶│  Reverse proxy (nginx/Caddy)  │
                          │  TLS, HSTS, rate limit, WAF   │
                          └───────┬───────────────┬───────┘
                                  │               │
                www.example.com   │               │  admin.example.com
                                  ▼               ▼
                      ┌───────────────────────────────────┐
                      │        Next.js application         │
                      │  (App Router, Node.js runtime)     │
                      │                                    │
                      │  ┌──────────────┬───────────────┐  │
                      │  │ Public site  │  Admin app    │  │
                      │  │ (SSR/ISR)    │  (SSR, no-    │  │
                      │  │ noindex off  │   store,      │  │
                      │  │              │   noindex)    │  │
                      │  └──────┬───────┴───────┬───────┘  │
                      │         │  Route handlers (REST)   │
                      │         ▼                          │
                      │  ┌──────────────────────────────┐  │
                      │  │  Application service layer   │  │
                      │  │  (domain modules, use cases) │  │
                      │  └──────────────────────────────┘  │
                      └───┬─────────┬──────────┬───────┬───┘
                          │         │          │       │
                  ┌───────▼──┐ ┌────▼────┐ ┌───▼────┐ ┌▼────────────┐
                  │PostgreSQL│ │  Redis  │ │  S3 /  │ │ AI provider │
                  │+pgvector │ │ cache + │ │ MinIO  │ │  adapter    │
                  │          │ │ BullMQ  │ │ object │ │ (Anthropic/ │
                  │          │ │ + rate  │ │ store  │ │  OpenAI)    │
                  └──────────┘ └────┬────┘ └────────┘ └─────────────┘
                                    │
                          ┌─────────▼──────────┐
                          │  Worker process    │
                          │  (BullMQ consumer) │
                          │  translations,     │
                          │  indexing, images, │
                          │  email, sitemaps   │
                          └────────────────────┘
```

Five containers in production: `web` (Next.js), `worker` (Node, same image, different entrypoint), `postgres`, `redis`, `minio` (or external S3), behind `proxy`.

### 1.2 Layering rules

```
app/                 ← routing, rendering, HTTP concerns only
  ├─ (public)/[locale]/...
  └─ (admin)/...
server/
  ├─ modules/<domain>/     ← use-cases + repository + validation per domain
  ├─ auth/                 ← sessions, MFA, step-up, guards
  ├─ ai/                   ← provider adapter, RAG, prompts, guards
  ├─ jobs/                 ← queue definitions + processors
  ├─ security/             ← rate limit, CSRF, headers, audit
  └─ db/                   ← Prisma client, transactions, soft-delete extension
lib/                 ← pure shared utilities (no I/O, no Prisma)
components/          ← presentational + composite UI
```

**Hard rules enforced by lint boundaries:**

1. `app/**` may import from `server/modules/**` *facades* only — never a Prisma model directly.
2. `components/**` may never import from `server/**`.
3. Every mutation passes through a use-case in `server/modules/**` that begins with an authorization check. There is no path from an HTTP handler to the database that skips it.
4. `lib/**` has no dependency on `server/**`.

### 1.3 Rendering strategy

| Surface | Strategy | Cache |
|---|---|---|
| Public pages, product/partner/brand/service/event/article detail | SSR + ISR with tag-based revalidation | `revalidateTag('product:<id>')` on mutation |
| Public listings with filters | SSR, Redis-cached query results (60 s) | Invalidated by entity tags |
| Global search | SSR, Postgres FTS, no ISR | Short Redis cache on hot terms |
| Admin | SSR, `Cache-Control: no-store`, dynamic always | None |
| API | Route handlers, explicit cache headers | Per-endpoint |

Publishing a record triggers `revalidateTag` for the entity, its listing, the sitemap and the search index — so "publish" is genuinely visible within seconds without a rebuild.

---

## 2. Technology stack and reasoning

| Layer | Choice | Why this and not the alternative |
|---|---|---|
| Framework | **Next.js 15 (App Router), React 19** | One codebase serves SSR public pages (needed for SEO + Core Web Vitals) and an authenticated admin SPA-like shell. Server Components keep the data layer off the client, which also removes a whole class of authorization leaks. Alternative (separate SPA + NestJS API) doubles deployment and duplicates auth for no gain at this scale. |
| Language | **TypeScript, `strict: true`, `noUncheckedIndexedAccess`** | Contract safety across 60+ entities. `any` is lint-banned except in typed escape hatches. |
| Styling | **Tailwind CSS v4 + CSS custom properties as design tokens** | Tokens live in CSS variables so a future theme/brand change is a token swap, not a component rewrite. Avoids runtime CSS-in-JS cost. |
| UI primitives | **Radix UI primitives + in-house component layer** | Accessible dialog/menu/tabs/combobox behaviour (focus trap, ARIA, keyboard) is the hardest part of §57 to get right by hand. We own the visual layer; Radix owns the behaviour. No opinionated template kit. |
| ORM | **Prisma 6** | Typed client, first-class migrations, relation modelling that matches this domain. A Prisma client extension gives us global soft-delete filtering and audit hooks in one place. Raw SQL via `$queryRaw` where Prisma is the wrong tool (FTS ranking, vector search). |
| Database | **PostgreSQL 16 + `pgvector` + `pg_trgm` + `unaccent`** | One engine for relational data, full-text search *and* RAG embeddings. Removes Elasticsearch and a separate vector DB from the stack — two fewer services to secure, back up and pay for. `pg_trgm` provides typo tolerance; `unaccent` + language-specific configs handle ru/uz; Chinese is handled with bigram indexing (see §7.4). |
| Cache/queue | **Redis 7 + BullMQ** | Queue, rate-limit counters, session revocation list, cached listings. Mature, operable, no cloud dependency. |
| Object storage | **S3-compatible (MinIO in dev/self-host, any S3 in cloud)** | Media never touches the app container's disk; presigned uploads keep large files off the app tier. |
| Auth | **Custom session auth: Argon2id + opaque server-side sessions in Postgres, mirrored revocation in Redis** | Requirement §65 (list/revoke sessions), §7 (step-up re-auth) and §6 (throttling, MFA) all need server-side session state. JWTs cannot be revoked; NextAuth's abstractions fight step-up re-authentication. ~400 lines of well-tested code, fully under our control. |
| MFA | **TOTP (RFC 6238) + single-use recovery codes** | Works offline, no SMS cost, no third party holding a factor. |
| Validation | **Zod** schemas shared between client form and server handler | One definition, enforced server-side regardless of the client. |
| Email | **Nodemailer with SMTP + React Email templates** | Provider-agnostic; works with any transactional provider the company already owns. |
| AI | **Adapter interface + Anthropic and OpenAI implementations** | §83 explicitly forbids provider coupling. Adapter covers `chat`, `stream`, `embed`, `countTokens`. |
| Testing | **Vitest** (unit/integration), **Supertest-style route tests**, **Playwright** (E2E) | Vitest for speed with TS/ESM; Playwright for the §70 critical scenarios including auth, step-up and upload validation. |
| Observability | **Pino structured logs + OpenTelemetry traces + Sentry-compatible error sink** | Vendor-neutral; the OTLP endpoint is configuration. |
| Container | **Docker multi-stage + docker-compose; GitHub Actions CI** | Reproducible builds, one image for `web` and `worker`. |

**Deliberate exclusions:** no Elasticsearch (Postgres FTS is sufficient at this content volume and adds no ops burden), no separate headless CMS (the CMS *is* the product requirement — a third-party CMS would make §7 step-up auth and §48 audit logging impossible to enforce), no GraphQL (REST + typed server actions covers the need with less surface area), no e-commerce engine at launch (§54 keeps the door open at the data-model level).

---

## 3. Database architecture

### 3.1 Core modelling patterns

Four patterns repeat across the schema. Understanding them makes the 60-table list short.

**P1 — Base entity + translation table.**
Every translatable entity splits into a base row (language-independent facts: slug, codes, relations, dates, status, flags) and N translation rows (one per locale).

```
Product                       ProductTranslation
├ id            uuid PK       ├ id           uuid PK
├ slug          citext UQ     ├ productId    → Product
├ sku                         ├ locale       → Locale
├ brandId       → Brand       ├ name
├ status        enum          ├ shortDescription
├ publishedAt                 ├ description       (rich text JSON)
├ deletedAt     (soft)        ├ benefits          (string[])
└ ...                         ├ applications
                              ├ status  enum(MISSING|AI_DRAFT|HUMAN_DRAFT|APPROVED)
                              ├ sourceHash  ← hash of source locale content
                              ├ translatedBy enum(HUMAN|AI)
                              ├ approvedById / approvedAt
                              └ UNIQUE(productId, locale)
```

`sourceHash` is what makes "outdated translation" detectable (§2.1): when the source-locale content changes, its hash changes, and every translation whose `sourceHash` no longer matches is flagged **Outdated**. It also prevents duplicate AI spend (§29) — unchanged content is never re-translated.

**P2 — Polymorphic SEO, media and audit attachments.**
`SeoMeta`, `MediaAttachment` and `AuditLog` attach to any entity via `(entityType, entityId)` with a composite index. One implementation, every module benefits.

**P3 — Soft delete everywhere that matters.**
`deletedAt`/`deletedById` on all content entities. A Prisma client extension injects `deletedAt: null` into every `find*` by default; recovering a record is an `update`. Permanent delete is a distinct use-case requiring step-up auth (§7).

**P4 — Versioning by snapshot.**
`ContentVersion(entityType, entityId, version, snapshot jsonb, diff jsonb, createdById, createdAt)`. Every mutation of a versioned entity writes a snapshot in the same transaction. Restore = write the snapshot back as a new version. Storage is bounded by a retention setting (default: 50 versions or 24 months, configurable).

### 3.2 Entity relationship overview

```
                    ┌──────────┐
                    │  Locale  │◄─────────── every *Translation table
                    └──────────┘

┌────────┐   ┌────────────┐   ┌──────────┐   ┌─────────────────┐
│  User  │──▶│  Session   │   │ AuditLog │   │ SecurityEvent   │
│ (role) │   │ (+MfaCred) │   │(polymorphic) │ (login/lockout) │
└────────┘   └────────────┘   └──────────┘   └─────────────────┘

        Partner ──┬──< PartnerTranslation
           │      ├──< PartnerDocument      ┌──────────────────┐
           │      ├──< PartnerMedia         │  PartnerCategory │
           │      └──> partnershipType      └──────────────────┘
           │
           ├───< Brand ──┬──< BrandTranslation
           │      │      └──< BrandDocument
           │      │
           │      └───< Product ──┬──< ProductTranslation
           │                      ├──< ProductMedia
           │                      ├──< ProductDocument
           │                      ├──< ProductSpecification (group,label,value,unit,order)
           │                      ├──< ProductAttributeValue ──> ProductAttribute (§53 extensible facets)
           │                      ├──>< ProductCategory   (M:N, categories are a tree)
           │                      ├──>< Service           (M:N)
           │                      ├──>< Event             (M:N)
           │                      ├──>< Resource          (M:N)
           │                      ├──>< Article           (M:N)
           │                      └──>< Product (self, "related products")
           │
           └──>< Service / Event / Resource / Article        (M:N via join tables)

  Page ──< PageBlock (type, order, props jsonb, enabled)
       └──< PageBlockTranslation (localized props jsonb)

  Menu ──< MenuItem (self-referencing tree) ──< MenuItemTranslation
                   └──> target: PAGE | PRODUCT | PARTNER | BRAND | SERVICE
                                | EVENT | ARTICLE | CATEGORY | EXTERNAL_URL | ROUTE

  MediaAsset ──< MediaVariant (webp/avif × sizes)
             ──< MediaAssetTranslation (alt, caption per locale)
             ──< MediaUsage (entityType, entityId, field)   ← §33 usage tracking

  Form ──< FormField ──< FormFieldTranslation
       └──< FormSubmission ──> Inquiry (lead pipeline, status machine)

  KnowledgeDocument ──< KnowledgeChunk (embedding vector(1536), locale, sourceRef)
  AIConversation ──< AIMessage        AIJob ──< AIJobItem        AIUsage (per call)

  SiteSetting (namespaced key/value, jsonb, localized where needed)
  Office ──< OfficeTranslation      SocialLink      Banner ──< BannerTranslation
  Certificate ──< CertificateTranslation
  Achievement ──< AchievementTranslation
  Testimonial ──< TestimonialTranslation      Faq ──< FaqTranslation
  NewsletterSubscriber      SearchQueryLog      PageView / EntityView
  CookieConsent (hashed visitor id, categories, timestamp)
```

### 3.3 Full model list

**Identity & security (11)**
`User`, `Session`, `MfaCredential`, `RecoveryCode`, `LoginAttempt`, `PasswordHistory`, `StepUpChallenge`, `AuditLog`, `SecurityEvent`, `ApiKey`, `RateLimitBucket` *(Redis-primary, Postgres for forensic retention)*

**Localization (3)**
`Locale`, `UiTranslation` *(interface strings, namespaced)*, `TranslationJobLink`

**Structure & CMS (9)**
`Page`, `PageTranslation`, `PageBlock`, `PageBlockTranslation`, `Menu`, `MenuItem`, `MenuItemTranslation`, `ContentVersion`, `Redirect`

**Media (4)**
`MediaAsset`, `MediaVariant`, `MediaAssetTranslation`, `MediaUsage`, plus `MediaFolder`, `MediaTag`

**Partners & brands (8)**
`Partner`, `PartnerTranslation`, `PartnerCategory`, `PartnerCategoryTranslation`, `PartnerDocument`, `PartnerMedia`, `Brand`, `BrandTranslation`, `BrandDocument`

**Products (10)**
`Product`, `ProductTranslation`, `ProductCategory`, `ProductCategoryTranslation`, `ProductMedia`, `ProductDocument`, `ProductSpecification`, `ProductAttribute`, `ProductAttributeValue`, `ProductRelation`

**Services, achievements, events (9)**
`Service`, `ServiceTranslation`, `ServiceFaq`, `Achievement`, `AchievementTranslation`, `Event`, `EventTranslation`, `EventMedia`, `EventSpeaker`

**Publishing & resources (9)**
`Article`, `ArticleTranslation`, `Tag`, `TagTranslation`, `ArticleTag`, `Resource`, `ResourceTranslation`, `ResourceDownload`, `Faq`, `FaqTranslation`

**Trust & company (8)**
`Certificate`, `CertificateTranslation`, `Office`, `OfficeTranslation`, `TeamMember`, `TeamMemberTranslation`, `Testimonial`, `TestimonialTranslation`, `SocialLink`, `Milestone`, `MilestoneTranslation`

**Forms & leads (5)**
`Form`, `FormField`, `FormFieldTranslation`, `FormSubmission`, `Inquiry`, `InquiryNote`

**AI (8)**
`KnowledgeDocument`, `KnowledgeChunk`, `AIConversation`, `AIMessage`, `AIUsage`, `AIJob`, `AIJobItem`, `AIPromptTemplate`

**Analytics & search (6)**
`PageView`, `EntityView`, `SearchQueryLog`, `CtaClick`, `DownloadEvent`, `AnalyticsDaily` *(rollup)*

**System (7)**
`SiteSetting`, `Banner`, `BannerTranslation`, `NewsletterSubscriber`, `CookieConsent`, `JobRun`, `Notification`

**Totals:** ~97 tables, ~62 distinct domain entities. Every content entity carries `status`, `deletedAt`, `createdById`, `updatedById`, `createdAt`, `updatedAt`.

### 3.4 Indexing plan (the ones that matter)

- `UNIQUE(entityType, slug)` per content table — slug uniqueness enforced at the DB level, surfaced as a friendly validation error (§77 duplicate-slug audit).
- `GIN(search_vector)` on a generated `tsvector` column per searchable translation table.
- `GIN(name gin_trgm_ops)` for typo-tolerant matching.
- `ivfflat(embedding vector_cosine_ops)` on `KnowledgeChunk`.
- Composite `(status, publishedAt DESC)` partial index `WHERE deletedAt IS NULL` on every public listing table.
- `(entityType, entityId, createdAt DESC)` on `AuditLog` and `ContentVersion`.
- `(locale, status)` on every translation table — this is what makes the translation-completeness dashboard fast.

---

## 4. Authentication architecture

### 4.1 Session model

Opaque 32-byte random session ID → SHA-256 hash stored in `Session`. The raw value lives only in the cookie. Cookie attributes: `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefix, `Domain` **unset** so the admin cookie cannot be read by the public host and vice versa.

```
Session { id, userTokenHash UQ, userId, createdAt, lastSeenAt, expiresAt,
          absoluteExpiresAt, ip, userAgent, mfaSatisfiedAt, revokedAt, revokedReason }
```

- **Idle timeout** 30 min (configurable), **absolute lifetime** 12 h. Both enforced server-side on every request.
- **Rotation** on privilege change and on MFA completion.
- Revocation list mirrored in Redis for O(1) check; Postgres is the source of truth for the §65 session list.

### 4.2 Login flow

```
POST /api/auth/login
  ├─ rate limit: 5 attempts / 15 min per (IP) and per (email), exponential backoff
  ├─ generic error for unknown-user and wrong-password (no enumeration)
  ├─ Argon2id verify (m=19456, t=2, p=1), constant-time compare on the timing-safe path
  ├─ record LoginAttempt(success/failure, ip, ua) always
  ├─ lockout: 10 failures / 30 min → account soft-lock, SecurityEvent + email to Super Admins
  ├─ if MFA enrolled → status "mfa_required", partial session (no authorization granted)
  ├─ TOTP verify (±1 step drift, replay-guard on last used counter) or recovery code
  └─ full session issued, rotated ID, AuditLog(LOGIN_SUCCESS)
```

Optional IP allow-list for the admin host is a `SiteSetting` (CIDR list) checked in admin middleware before anything else — off by default, documented as a production hardening step.

### 4.3 Step-up re-authentication (§7)

Every destructive or security-sensitive use-case declares `requiresStepUp: true`. The rule is enforced **in the use-case**, not in the route:

```
1. Client calls the mutation.
2. Guard checks Session.stepUpVerifiedAt within STEP_UP_TTL (5 min, per-action scope).
3. If absent → 428 { code: "STEP_UP_REQUIRED", action, scope, mfaRequired: boolean }
4. Client shows "Confirm your password to continue" (+ TOTP if enrolled).
5. POST /api/auth/step-up { password, totp?, actionScope } → rate limited, audited,
   writes StepUpChallenge(consumed=false, scope, expiresAt).
6. Client retries the mutation with the challenge token; the guard consumes it (single use).
```

Actions requiring step-up: permanent delete of any entity, bulk destructive operations, user create/delete/role change, security settings, API key change, AI configuration change, media permanent delete, restore of system data, maintenance-mode toggle, import that overwrites, and any AI-issued destructive command (§30).

### 4.4 Password policy

Argon2id; minimum 12 characters; checked against a local breached-password list (k-anonymity hash prefix, offline list — no external call); last 5 hashes retained in `PasswordHistory` to block reuse; forced rotation **not** enforced by default (NIST 800-63B guidance), but available as a setting.

---

## 5. Authorization — Super Admin vs Viewer matrix

Roles map to explicit capability constants. Every use-case declares the capability it needs; the guard is the first statement of the function body. The frontend reads the *same* capability list to hide controls — but hiding is cosmetic only.

```ts
type Capability =
  | 'content.read' | 'content.create' | 'content.update' | 'content.publish'
  | 'content.archive' | 'content.delete.soft' | 'content.delete.permanent' | 'content.restore'
  | 'translation.read' | 'translation.edit' | 'translation.approve' | 'translation.ai.run'
  | 'media.read' | 'media.upload' | 'media.delete'
  | 'menu.read' | 'menu.manage'
  | 'inquiry.read' | 'inquiry.update' | 'inquiry.export'
  | 'analytics.read' | 'analytics.export'
  | 'user.read' | 'user.manage'
  | 'security.read' | 'security.manage' | 'session.revoke'
  | 'settings.read' | 'settings.manage'
  | 'ai.public.configure' | 'ai.admin.use' | 'ai.usage.read'
  | 'audit.read'
  | 'import.run' | 'export.run'
  | 'bulk.run'
```

| Capability group | SUPER_ADMIN | VIEWER |
|---|:---:|:---:|
| Log into admin | ✅ | ✅ |
| Dashboard (read-only widgets) | ✅ | ✅ |
| Read any content, product, partner, brand, service, event, article, resource | ✅ | ✅ |
| Create / update content | ✅ | ❌ |
| Publish / unpublish / schedule | ✅ | ❌ |
| Archive / soft delete | ✅ | ❌ |
| Restore | ✅ | ❌ |
| **Permanent delete** (step-up + MFA) | ✅ | ❌ |
| Media upload / replace / delete | ✅ | ❌ |
| Media library browse | ✅ | ✅ |
| Menus: read | ✅ | ✅ |
| Menus: create/edit/reorder/disable/delete | ✅ | ❌ |
| Translations: view status & completeness | ✅ | ✅ |
| Translations: edit / approve / run AI | ✅ | ❌ |
| Inquiries: list & read | ✅ | ✅ (read-only, PII-masked by default setting) |
| Inquiries: change status, add notes, export | ✅ | ❌ |
| Forms: build/modify | ✅ | ❌ |
| Analytics: view | ✅ | ✅ |
| Analytics: export | ✅ | ❌ |
| Audit log: read | ✅ | ❌ |
| Security center: view | ✅ | ❌ |
| Security settings, session revoke, IP rules | ✅ | ❌ |
| Users & roles | ✅ | ❌ |
| Site settings, languages, default locale | ✅ | ❌ |
| AI admin assistant: analytical queries | ✅ | ❌ |
| AI admin assistant: content mutations | ✅ (+ review step) | ❌ |
| AI configuration, limits, provider keys | ✅ | ❌ |
| Import / export data | ✅ | ❌ |
| Bulk operations | ✅ | ❌ |
| Maintenance mode | ✅ | ❌ |

Viewer PII masking on inquiries is a `SiteSetting` (`inquiry.viewerSeesPii`, default `false`): email/phone render as `j•••@•••.com` until a Super Admin enables full visibility.

**Enforcement test suite** (§70): for every capability, an automated test asserts a Viewer session receives `403` from the API route *and* that the use-case throws when called directly with a Viewer actor. New endpoints without a guard fail a lint rule and a test that enumerates all route handlers.

---

## 6. Multilingual architecture

### 6.1 Three separate concerns, three mechanisms

| Concern | Mechanism | Editable by |
|---|---|---|
| **UI strings** (buttons, labels, validation messages, date formats) | `next-intl` message catalogues in `messages/<locale>.json`, overridable at runtime by `UiTranslation` rows | Developer default + Super Admin override in admin UI |
| **Content** (every entity) | `*Translation` tables, per-locale status | Super Admin, AI-assisted |
| **Metadata/SEO** | `SeoMeta` rows keyed by `(entityType, entityId, locale)` | Super Admin, AI-assisted |

No translated business string is ever hardcoded in a component (§40, §79). A lint rule flags string literals in JSX outside of `t()` calls.

### 6.2 Routing

```
/                    → 307 to negotiated locale (cookie > Accept-Language > default)
/<locale>/           → home
/<locale>/products/              /<locale>/products/<slug>
/<locale>/partners/              /<locale>/partners/<slug>
/<locale>/brands/                /<locale>/brands/<slug>
/<locale>/services/              /<locale>/services/<slug>
/<locale>/events/                /<locale>/events/<slug>
/<locale>/news/                  /<locale>/news/<slug>
/<locale>/resources/             /<locale>/resources/<slug>
/<locale>/achievements/          /<locale>/certificates/
/<locale>/about/  /contact/  /search/  /<locale>/<cms-page-slug>
```

Locale segment is always explicit (no bare-root content) — this keeps hreflang honest and canonical URLs unambiguous. Slugs are **per-locale** (`ProductTranslation.slug`) with a fallback to the base slug, so `/zh/products/牙科复合树脂` and `/en/products/dental-composite` can both resolve to the same product while each carrying its own canonical.

A `Redirect` table captures slug changes automatically: renaming a published slug writes a 301 from the old path. No dead links after an edit.

### 6.3 Translation status machine

```
MISSING ──AI run──▶ AI_DRAFT ──human edit──▶ HUMAN_DRAFT ──approve──▶ APPROVED
   ▲                                                                     │
   └──────────────── source content changed (sourceHash mismatch) ───────┘
                                    ▼
                                OUTDATED  (content stays live, flagged in admin)
```

**AI output is never publishable on its own.** A translation in `AI_DRAFT` renders on the public site only if `SiteSetting('i18n.publishAiDrafts')` is explicitly enabled (default **off**); otherwise the public page falls back to the default locale for that field and the page is excluded from that locale's sitemap. Approval is a distinct capability with its own audit event.

### 6.4 Fallback rules

Per-field fallback chain: `requested locale → default locale → any approved locale`. The chain is applied at the repository layer so no page can render an empty section. A `data-fallback-locale` attribute is emitted in development to make gaps visible.

### 6.5 RTL readiness (not shipped)

All layout uses logical CSS properties (`margin-inline-start`, `padding-block`, `inset-inline`) rather than left/right; `dir` is derived from `Locale.direction` on `<html>`; icon mirroring is a single utility class. Adding Arabic later is: insert a `Locale` row, add a message catalogue, flip `direction`. No component rewrite.

### 6.6 Chinese specifics

`zh-Hans` as the stored locale code with `zh` as the URL segment. Font stack includes `Noto Sans SC` with `font-display: swap` and subsetting; line-height and letter-spacing tokens have a CJK variant; no word-break assumptions; search uses bigram tokenisation (§7.4); number and date formatting via `Intl` with the `zh-CN` locale.

---

## 7. AI and RAG architecture

### 7.1 Provider abstraction

```ts
interface AIProvider {
  readonly id: 'anthropic' | 'openai'
  chat(req: ChatRequest): Promise<ChatResponse>
  stream(req: ChatRequest): AsyncIterable<ChatDelta>
  embed(texts: string[], opts: EmbedOptions): Promise<number[][]>
  countTokens(text: string): number
  capabilities: { tools: boolean; jsonMode: boolean; maxContext: number }
}
```

`AIRouter` resolves a provider per *task type* (`public_chat`, `translate`, `seo`, `summarize`, `embed`, `audit`) from `SiteSetting('ai.routing')`, with a documented fallback chain on provider error. Every call goes through `withUsageTracking()` which writes an `AIUsage` row (task, provider, model, input/output tokens, latency, estimated cost, actor, entity ref, success/error) — that is what makes §29 real numbers rather than a decorative chart.

### 7.2 Public assistant — grounded retrieval

**Indexing pipeline** (background job, triggered on publish/unpublish/update):

```
Published entity ──▶ Normalizer ──▶ Chunker ──▶ Embedder ──▶ KnowledgeChunk
  (product/partner/    (strip HTML,   (~800 tok,   (adapter)    (vector, locale,
   brand/service/       keep specs     150 overlap,              entityType, entityId,
   event/article/       as key:value,  never splits              sourceUrl, updatedAt)
   resource/page/FAQ)   preserve SKU)  a spec table)
```

Only `status = PUBLISHED`, `deletedAt IS NULL`, `visibility = PUBLIC` rows are indexed. Unpublish or soft-delete removes the chunks in the same transaction-adjacent job. There is no path by which a draft, an archived record or an admin-only document enters the public index — enforced by the indexer reading through the *public* repository, the same one the public site uses.

**Answering:**

```
User question
  ├─ language detection (+ explicit user override)
  ├─ input guard: length cap, injection heuristics, PII scrub on logs
  ├─ hybrid retrieval: vector (pgvector cosine, k=24, locale-filtered with
  │  cross-locale fallback) ⊕ lexical (Postgres FTS) → Reciprocal Rank Fusion → top 8
  ├─ structured-intent shortcut: if the question maps to a catalogue query
  │  ("implantology products from Korea"), run the *real* filtered DB query
  │  and return entity cards — not prose
  ├─ prompt assembly: system rules + retrieved passages with IDs + question
  ├─ generation with citation requirement: every factual claim cites [chunkId]
  ├─ post-check: strip any citation the model invented; if zero valid citations
  │  support a factual claim → return the "I don't have that information" path
  └─ response = prose + structured cards (product/partner/brand/service/resource)
                + source links
```

**Grounding guarantee.** The system prompt forbids stating any specification, certification, price, partner relationship or company claim not present in the retrieved context. The post-check enforces it mechanically: claims without a resolvable citation are not shipped. When context is insufficient, the assistant says so and offers the contact form — it does not improvise.

**Medical safety (§75).** The assistant is scoped to company, product and service information. Clinical questions ("what treatment should this patient get") receive a clear limitation response plus a pointer to consult a qualified dental professional. It never diagnoses, never recommends treatment, never states clinical outcomes. This is both a prompt rule and a classifier check on the outbound message.

### 7.3 Admin assistant

Same provider layer, different tool set. The admin assistant is a **tool-calling agent with a whitelisted, typed tool registry**:

| Tool | Type | Authorization |
|---|---|---|
| `findMissingTranslations(entity?, locale?)` | read | `translation.read` |
| `findContentIssues(check)` (missing SEO, alt text, logos, expired certs, duplicate slugs, broken links) | read | `content.read` |
| `queryAnalytics(metric, range)` | read | `analytics.read` |
| `proposeTranslation(entityRef, locale)` | write-as-draft | `translation.ai.run` |
| `proposeSeo(entityRef, locale)` | write-as-draft | `content.update` |
| `rewrite(text, tone)` | pure | `ai.admin.use` |
| `summarize(entityRef)` | pure | `ai.admin.use` |
| `generateAltText(mediaId)` | write-as-draft | `media.upload` |
| `enqueueBulkTranslation(selection, locales)` | job | `translation.ai.run` + confirmation |

**Every tool call runs with the caller's own actor and permission set** — the assistant cannot exceed the human's authority. Write tools produce **drafts and proposals only**. Nothing publishes. Destructive intent is never executed inline: the assistant returns a *plan* object that the UI renders as an explicit confirmation with count, scope, irreversibility warning, and a password (+MFA) prompt (§30). The confirmation is executed by the normal use-case with the normal guard — the AI path has no privileged shortcut.

### 7.4 Multilingual search + AI language support

Search (§22) and RAG share the retrieval substrate:

- **ru/en/uz:** `to_tsvector` with language config where available, `unaccent`, plus `pg_trgm` similarity for typo tolerance (threshold 0.3, tuned against zero-result logs).
- **uz:** Latin/Cyrillic transliteration normalisation at index and query time so `Toshkent` and `Тошкент` match.
- **zh:** bigram tokenisation at index time (no whitespace segmentation), trigram fallback, plus vector search which handles CJK semantics well.
- Results grouped by entity type with per-group relevance; zero-result and top queries logged to `SearchQueryLog` for the §22 admin analytics.

### 7.5 AI cost control and caching

- Per-period token/cost budget in settings, with warning at 70 % and hard stop at 100 % (hard stop degrades the public assistant to search-only, never to a fabricated answer).
- Response cache keyed by `hash(normalizedQuestion + locale + indexVersion)` with a short TTL for the public assistant.
- Translation dedup by `sourceHash` — identical source content is never paid for twice.
- Embedding dedup by `hash(chunkText)`.
- Per-IP and per-session rate limits on the public assistant; per-user limits on the admin assistant.

### 7.6 AI security (§30)

| Threat | Control |
|---|---|
| Prompt injection from content | Retrieved passages are delimited and labelled untrusted data; the system prompt states that instructions inside passages are content, not commands. Tool calls are validated against the registry and the caller's capabilities regardless of what the model asks for. |
| System prompt extraction | Prompt is server-side only; extraction attempts are refused and logged; no prompt content in client payloads or error messages. |
| Data exposure | Public assistant reads exclusively from the public index (§7.2). Separate provider credentials and separate rate-limit pools for public vs admin. |
| Malicious document ingestion | Uploaded documents are type/MIME/size validated, text-extracted in a sandboxed job, and never executed. Extracted text is treated as untrusted. |
| Secret leakage | Provider keys live in env/secret store, never in the DB in plaintext (keys entered in admin are encrypted at rest with a KMS/env master key and are write-only in the UI). Outbound payloads pass a secret-pattern scrubber. |
| Privilege escalation | Tools execute as the caller; destructive operations require the same step-up flow as manual ones. |

---

## 8. Public website sitemap

```
/<locale>/
├── about/
│   ├── (overview, mission, vision, values, timeline, team, coverage, standards)
│   └── company-profile (download)
├── partners/                      filters: q, country, type, specialization, verified, featured
│   └── <partner-slug>/            overview, location, brands, products, services,
│                                  certifications, documents, gallery, video, contact CTA
├── brands/
│   └── <brand-slug>/              products, manufacturer/partner, documents, gallery
├── products/                      filters: category, subcategory, brand, partner, country,
│   │                              application, technology, treatment area + sort
│   ├── category/<category-path>/  nested category landing pages
│   └── <product-slug>/            gallery, benefits, specifications, applications,
│                                  documents, certificates, video, downloads,
│                                  related products/services/partner/brand, inquiry CTA
├── services/
│   └── <service-slug>/            description, benefits, process, FAQ, related, CTA
├── achievements/
├── events/                        upcoming / past, calendar + timeline view
│   └── <event-slug>/              participation info, booth, speakers, gallery,
│                                  related partners/products/news, materials
├── news/                          categories + tags
│   ├── category/<slug>/   tag/<slug>/
│   └── <article-slug>/
├── resources/                     filters: type, language, category, partner, product
│   └── <resource-slug>/           (download tracked)
├── certificates/                  Trust Center: certificates, licenses, memberships, policies
├── contact/                       offices, map, general + typed inquiry forms
├── search/                        grouped global results
├── legal/privacy  terms  cookies  disclaimer
└── optional (CMS-toggled): faq/  careers/  distributors/  media/  testimonials/
```

Machine endpoints: `/sitemap.xml` (index) → `/sitemaps/<entity>-<locale>-<n>.xml`, `/robots.txt`, `/<locale>/rss.xml`, `/opensearch.xml`.

**No admin link appears anywhere** in the public header, footer, sitemap, robots.txt or HTML comments (§4, §81).

## 9. Admin panel sitemap

```
admin.<domain>/
├── login  ·  mfa  ·  recovery
├── dashboard                     real counts, inquiries, translation completeness,
│                                 popular content, recent activity, alerts
├── content/
│   ├── pages/            list · editor (block builder) · versions · SEO · translations
│   ├── menus/            tree editor, drag-reorder, targets, per-locale labels, visibility
│   └── blocks-library/
├── catalog/
│   ├── products/         list (filters, bulk) · editor · specs · media · documents ·
│   │                     relations · translations · SEO · versions
│   ├── categories/       tree
│   └── attributes/       facet definitions (§53)
├── partners/   brands/   services/   achievements/   events/   news/   resources/
│   └── (same shape: list · editor · translations · SEO · media · relations · versions)
├── trust/certificates/   ·   company/offices  team  milestones  testimonials  faq
├── media/                library, folders, tags, alt text, usage, variants
├── forms/                builder · fields · notifications
├── inquiries/            pipeline board + table, statuses, notes, export
├── translations/
│   ├── overview          completeness matrix per entity × locale
│   ├── missing / outdated / ai-drafts / pending-approval queues
│   └── ui-strings        interface catalogue override
├── search/               index status, top queries, zero-result queries
├── ai/
│   ├── assistant         admin AI console
│   ├── jobs              queued/processing/completed/failed/needs-review + retry
│   ├── knowledge         index status, reindex, coverage per entity/locale
│   ├── usage             requests, tokens, cost, per period, limits
│   └── settings          provider routing, models, budgets, prompts
├── analytics/            traffic, entities, downloads, inquiries, searches,
│                         CTA clicks, language usage, AI interactions
├── seo/                  global defaults, per-entity audit, redirects, sitemap status
├── audit/                immutable activity log with filters and diff view
├── security/             sessions, logins, failures, MFA, IP rules, alerts
├── users/                accounts, roles, MFA status
├── settings/
│   ├── general  ·  languages  ·  branding  ·  navigation defaults
│   ├── contact  ·  social  ·  footer  ·  banners
│   ├── cookies & consent  ·  legal pages
│   ├── maintenance mode
│   └── integrations (SMTP, storage, analytics, AI keys)
├── import-export/        CSV/XLSX/JSON, validate → preview → confirm → summary
└── trash/                soft-deleted items, restore, permanent delete (step-up)
```

---

## 10. Security architecture

### 10.1 Defence layers

| Layer | Controls |
|---|---|
| Edge / proxy | TLS 1.2+, HSTS preload, request size caps, connection rate limits, optional WAF rules, separate server blocks for public and admin hosts |
| Middleware | Host-based routing guard (admin routes 404 on the public host), IP allow-list (optional), bot/abuse throttling, security headers |
| Headers | `Content-Security-Policy` (nonce-based, no `unsafe-inline` in production), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `X-Frame-Options: DENY` on admin |
| Session | HttpOnly/Secure/SameSite/`__Host-`, idle + absolute expiry, rotation, server-side revocation |
| CSRF | SameSite=Lax + double-submit token on all state-changing requests + `Origin`/`Sec-Fetch-Site` verification |
| Input | Zod validation at every boundary; rich text sanitised server-side with an allow-list sanitiser (DOMPurify-equivalent on the server) before storage *and* escaped at render |
| Output | React escaping by default; `dangerouslySetInnerHTML` permitted only for sanitiser-processed content, behind a single audited component |
| SQL | Prisma parameterisation; `$queryRaw` only with tagged templates (never string concatenation), lint-enforced |
| Files | Extension + magic-byte MIME verification + size cap + image re-encode (strips EXIF and embedded payloads) + randomised storage keys + `Content-Disposition: attachment` + no execution path in the storage bucket; SVG uploads sanitised or rejected by setting |
| Authorization | Server-side capability guard in every use-case; automated enumeration test |
| Secrets | Env/secret store only; `.env` git-ignored; `.env.example` documents every key; secret scanning in CI |
| Audit | Append-only `AuditLog`; no delete capability exposed in code or UI; retention-based archival only |
| Dependencies | Lockfile, `npm audit` + Dependabot in CI, pinned base images |

### 10.2 Rate limiting map

| Endpoint class | Limit |
|---|---|
| Admin login | 5 / 15 min per IP, 5 / 15 min per account, lockout at 10 |
| Step-up challenge | 5 / 10 min per session |
| Public forms | 3 / 10 min per IP + honeypot + time-trap + optional Turnstile |
| Public AI assistant | 10 / min, 100 / day per visitor; global budget guard |
| Search | 30 / min per IP |
| Public API reads | 120 / min per IP |
| Downloads | 60 / min per IP |

### 10.3 Audit event schema (§48)

```
AuditLog { id, actorId, actorRole, action, entityType, entityId, entityLabel,
           before jsonb?, after jsonb?, diff jsonb?, ip, userAgent, locale?,
           success, failureReason?, requestId, stepUpUsed, createdAt }
```

Written inside the same transaction as the mutation, so an audited action cannot succeed unlogged. Failed authorization attempts are logged too — that is the early-warning signal. The admin UI renders diffs field-by-field.

---

## 11. API architecture

Three surfaces, deliberately separated:

1. **Server Actions / internal use-cases** — admin mutations from the admin UI. Typed end-to-end, CSRF-protected, guard-first.
2. **Public read API** `/api/public/v1/*` — versioned, unauthenticated, cacheable, rate-limited. Powers the public site's client-side filtering and is the future integration point for a mobile app.
3. **Admin API** `/api/admin/v1/*` — session-authenticated, capability-checked, used by the admin UI where a REST shape fits better than an action (tables, exports, uploads).

**Conventions:**

```
GET /api/public/v1/products?locale=en&category=implantology&brand=<slug>
    &country=KR&page=2&pageSize=24&sort=-publishedAt&q=abutment

200 {
  data: [...],
  meta: { page, pageSize, total, totalPages, sort, appliedFilters },
  links: { self, next, prev }
}
```

Errors are a single shape, never leaking internals (§87):

```
4xx/5xx {
  error: { code: "VALIDATION_FAILED", message: "<safe, localized>",
           details?: [{ field, code }], requestId: "..." }
}
```

Server-side, the full error with stack goes to structured logs keyed by the same `requestId`. Clients get the id and nothing else.

Cursor pagination is used for large admin tables and exports; offset for public listings where deep paging is bounded. OpenAPI 3.1 spec is generated from the Zod schemas (`zod-to-openapi`) and served at `/api/docs` in non-production, kept as a committed artefact for production reference.

---

## 12. Storage architecture

```
Upload (admin)
  ├─ client requests presigned PUT from /api/admin/v1/media/presign
  │    → server validates declared type/size, generates key: media/<yyyy>/<mm>/<uuid>.<ext>
  ├─ client PUTs directly to S3/MinIO (app tier never buffers the file)
  ├─ client confirms → server HEADs the object, verifies size and magic bytes
  ├─ MediaAsset row created (status=PROCESSING)
  └─ job: virus/type re-check → image re-encode (strip metadata) →
          variants (AVIF/WebP/JPEG × 320/640/960/1280/1920) → blurhash →
          MediaAsset status=READY, MediaVariant rows
```

- **Public media:** served through a CDN-friendly path with long `Cache-Control` and immutable hashed keys.
- **Private documents** (e.g. partner-only or internal files, and all future B2B documents): stored in a separate prefix with **no public read**; served through a short-lived presigned URL issued only after an authorization check. The distinction is a column (`MediaAsset.visibility`) so the future distributor portal does not need a storage migration.
- **Backups:** database dumps and a bucket lifecycle policy (see §14).
- **Local dev:** MinIO with the same API, so no code differs between environments.

---

## 13. Deployment and infrastructure architecture

### 13.1 Environments

| Env | Purpose | Data | Notes |
|---|---|---|---|
| Development | Local docker-compose | Seed data, clearly labelled | `SEED_DATA=true` banner in admin |
| Staging | Pre-production verification | Anonymised copy or seed | Password-protected, `noindex` globally |
| Production | Live | Real | Secrets from the host's secret store |

Environment parity is enforced by using the same image and the same compose topology; only env vars and scale differ.

### 13.2 Container layout

```yaml
services:
  proxy:     nginx (TLS, headers, rate limit, static passthrough)
  web:       node:22-alpine, next start          (2+ replicas)
  worker:    same image, `node worker.js`        (1-2 replicas)
  postgres:  postgres:16 + pgvector              (volume, WAL archiving)
  redis:     redis:7 (appendonly)                (volume)
  minio:     S3-compatible                       (volume; or external S3)
```

Multi-stage Dockerfile: `deps → build → runner`, non-root user, `output: 'standalone'`, healthchecks on `/api/health` (liveness) and `/api/health/ready` (DB + Redis + storage reachability).

### 13.3 CI/CD pipeline

```
push → typecheck → lint → unit tests → integration tests (ephemeral PG+Redis)
     → build image → E2E (Playwright against the built image)
     → security scan (npm audit, secret scan, image scan)
     → push image → deploy staging → smoke tests
     → manual approval → migrate (prisma migrate deploy) → deploy production
     → post-deploy smoke + sitemap ping
```

Migrations run as a separate job before the new image serves traffic; migrations are additive-first (expand → migrate data → contract) so a rollback never loses columns.

### 13.4 Backup and recovery

| What | How | Frequency | Retention |
|---|---|---|---|
| PostgreSQL | `pg_dump` (logical) + continuous WAL archiving to object storage | Dump nightly; WAL continuous | 7 daily, 4 weekly, 12 monthly |
| Object storage | Bucket versioning + cross-bucket replication | Continuous | 30 days of versions |
| Secrets | Host secret store, documented recovery procedure | — | — |
| Restore drill | Documented runbook, executed quarterly on staging | — | RPO ≤ 15 min, RTO ≤ 2 h |

`docs/OPERATIONS.md` will carry the exact commands for backup, point-in-time restore, and the migration-safety checklist.

### 13.5 Observability

Structured JSON logs (Pino) with `requestId` correlation; OpenTelemetry traces for HTTP → use-case → DB → AI provider; error sink (Sentry-compatible, self-hostable via GlitchTip); queue dashboards for BullMQ; uptime checks on `/api/health/ready`; DB slow-query logging; alert rules for failed jobs, auth lockouts, AI budget thresholds and 5xx rate.

---

## 14. Development phases

| Phase | Deliverable | Exit criteria |
|---|---|---|
| **0** | This architecture document | Approved |
| **1** | Foundation: repo, TS strict, Tailwind + tokens, Docker compose, CI, health checks, env handling | `docker compose up` yields a running app; CI green |
| **2** | Database: full Prisma schema, migrations, soft-delete extension, versioning, audit plumbing, seed | `prisma migrate` clean; seed produces a browsable dataset |
| **3** | Auth & RBAC: login, MFA, sessions, lockout, step-up, capability guards, security center | Authorization test suite green for every capability |
| **4** | Admin shell: navigation, tables, forms, dialogs, empty states, unsaved-change guards, i18n of the admin UI | A non-developer can navigate without instruction |
| **5** | CMS core: pages + block builder, menus, media library, settings, banners, footer | A page can be built, reordered, published, versioned and restored without code |
| **6** | Directories: partners, brands, products (+categories, attributes, specs, relations) | Full CRUD + relations + bulk + import/export |
| **7** | Services, achievements, events, news, resources, certificates, company/team/offices | Public detail pages render from DB only |
| **8** | Multilingual system: translation tables wired, completeness matrix, workflow, UI string overrides | Completeness dashboard reflects reality |
| **9** | Public site: design system, all routes, SEO infrastructure, structured data, sitemaps, hreflang | Lighthouse ≥ 95 perf / 100 a11y / 100 SEO on key templates |
| **10** | Search: FTS + trigram + CJK, grouped results, query logging | Typo and cross-locale queries return sensible results |
| **11** | Forms, inquiries, notifications, newsletter | Submission → DB → email → pipeline works end to end |
| **12** | Analytics: collection, rollups, dashboards | Dashboard numbers reconcile with raw events |
| **13** | AI: provider adapter, indexing, public assistant, admin assistant, jobs, usage, guards | Grounding, citation and refusal behaviour verified by tests |
| **14** | Hardening: headers, CSP, rate limits, upload validation, audit coverage, pen-test checklist | Security checklist signed off |
| **15** | Testing & performance: full suite, load test, query tuning, caching | Coverage targets met; p95 latency budget met |
| **16** | Deployment: staging, production runbooks, backups, monitoring, restore drill | Restore drill passed on staging |

Phases 5–13 ship module by module; each module is independently deployable and testable.

---

## 15. Risks and mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | **Scope breadth** — 90 requirement sections is a multi-month build; a rushed "everything at once" attempt produces a shallow demo | Project fails its own acceptance criteria (§86) | Strict phase gating with exit criteria; each phase is genuinely finished (tests + audit + i18n) before the next starts. No module is marked done while any part of it is mocked. |
| R2 | **AI hallucination of business facts** — invented specs, certifications or partner claims | Legal and reputational damage in a medical-adjacent industry | Retrieval-only grounding, mechanical citation validation, refusal path, medical-scope limiter, plus §80's rule that seed data never implies real claims. |
| R3 | **Prompt injection via CMS content** | Assistant coerced into leaking prompts or misusing tools | Untrusted-data framing, tool registry allow-list, capability checks on every tool call as the caller, no destructive tool executes inline. |
| R4 | **Translation drift** — source edited, translations silently stale | Wrong information published in ru/uz/zh | `sourceHash` outdated detection, admin queue, sitemap exclusion of unapproved locales, fallback chain that never renders empty. |
| R5 | **Chinese search and typography quality** | Poor experience for a target market | Bigram indexing + vector retrieval, CJK type tokens, native-speaker review checkpoint before launch (flagged as a business task, not a code task). |
| R6 | **Admin surface discovery / credential attack** | Compromise of the whole CMS | Separate host, no public references, `noindex`, throttling + lockout, MFA, optional IP allow-list, step-up on destructive actions, session revocation, full audit. |
| R7 | **Unsafe file uploads** | Stored XSS or malware distribution | Magic-byte verification, re-encode images, sanitise/reject SVG, randomised keys, attachment disposition, no execution in bucket. |
| R8 | **AI cost overrun** | Unbudgeted spend | Per-period budgets with hard stop, dedup by content hash, response caching, per-user and per-IP limits, usage dashboard. |
| R9 | **Performance regression from CMS flexibility** — arbitrary blocks and deep relations cause N+1 queries | Slow pages, poor Core Web Vitals | Repository-level eager loading per template, query budget assertions in tests, Redis caching of listings, ISR with tag invalidation, index plan in §3.4. |
| R10 | **Data loss on destructive operations** | Irrecoverable content loss | Soft delete by default, versioning with restore, step-up on permanent delete, nightly dumps + WAL PITR, quarterly restore drill. |
| R11 | **Schema rigidity blocking future B2B/ERP modules** | Expensive rewrite later | Product model already carries SKU/unit/packaging and an extensible attribute system; `MediaAsset.visibility` supports private documents; account/pricing/order tables are designed-for but not created; all modules communicate through use-case facades so a new bounded context plugs in rather than threads through. |
| R12 | **Single-operator bus factor** on an unfamiliar custom CMS | Company cannot maintain the platform | Admin UX designed for non-developers (§78), inline help, seeded example content, and `docs/` covering operations, content model and runbooks. |
| R13 | **Legal/compliance overreach** — claiming GDPR "compliance" | Misleading the business | Architecture provides the *mechanisms* (consent records, retention config, export/delete paths, audit). The documentation states plainly that legal compliance requires review by qualified counsel; no compliance claim is asserted in code or copy. |
| R14 | **Missing real business content at launch** | Empty or fake-looking site | Every hardcodable value is a CMS field with a clearly-marked editable placeholder; a launch checklist enumerates every placeholder that must be replaced before go-live. Seed data is visibly labelled and refuses to load with `NODE_ENV=production` unless explicitly forced. |

---

## 16. What "done" means

Per §86, the platform is complete only when each of these is real, server-enforced and covered by an automated test: authentication, authorization, CMS, product/partner/brand CRUD, menu management, multilingual content, translation workflow, contact forms, inquiry storage, search, AI integration, admin access control, critical-action protection, audit logs, SEO, responsive layout, media management.

No module is reported as complete while any part of it is mocked, stubbed, hardcoded or frontend-only.
