# Deployment

This describes taking the platform from a working checkout to a running
production site. It assumes one Linux host with Docker available, or a
Node-capable host plus managed PostgreSQL and Redis — both are covered.

---

## What has to exist before anything runs

| Piece           | Why it is needed                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------- |
| PostgreSQL 16+  | The whole content model. Needs the `pgvector`, `pg_trgm`, `unaccent` and `citext` extensions.   |
| Redis 7+        | Rate limiting, caching and the background job queue.                                            |
| Node.js 22+     | Runtime for the web process and the worker.                                                     |
| A writable disk | Uploaded media, with `MEDIA_DRIVER=local`. Must survive restarts and deploys.                   |
| TLS             | Sessions are `secure` cookies in production; the panel will not sign anyone in over plain HTTP. |

Two processes run, not one: the **web** process (`node .next/standalone/server.js`)
and the **worker** (`node dist-worker/worker.js`). The worker sends mail, rebuilds
search indexes and runs scheduled jobs. A deployment without it looks healthy and
quietly stops delivering enquiry notifications, which is the kind of failure
nobody notices for a week.

---

## Two hosts, two names

The admin panel is served on its own hostname and the public site returns **404**
for every admin path. That is the point of §4: a scan of the public site finds no
sign that an administration surface exists.

```
NEXT_PUBLIC_SITE_URL=https://vds.uz
ADMIN_HOST=admin.vds.uz
ADMIN_PATH_FALLBACK=false      # development convenience only — must be false here
```

Leaving `ADMIN_PATH_FALLBACK=true` in production puts the login form on the
public hostname. Both names point at the same process; the edge proxy separates
them by `Host` header.

---

## Environment

Copy `.env.example`, then generate the two secrets rather than inventing them:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"   # SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # ENCRYPTION_KEY
```

`ENCRYPTION_KEY` must decode to **exactly 32 bytes** — it is used directly as an
AES-256 key. Changing it later makes every stored secret unreadable, so keep it
with the database backups, not only in the deployment tool.

The application validates all of this at boot and refuses to start on a bad
value. That is deliberate: a site that starts with a missing `SESSION_SECRET` is
worse than one that does not start.

### Media

```
MEDIA_DRIVER=local
MEDIA_LOCAL_DIR=/var/lib/vds/media     # a mounted volume, not a container path
```

Uploads live outside `public/` and are served by a route handler, so this
directory must be mounted and backed up. Pointing it at ephemeral container
storage loses every upload on the next deploy. `MEDIA_DRIVER=s3` is declared but
not implemented, and fails loudly at startup rather than silently writing to disk.

### AI

```
GROQ_API_KEY=gsk_...          # https://console.groq.com/keys
AI_DEFAULT_CHAT_PROVIDER=groq
AI_DEFAULT_EMBED_PROVIDER=none
```

Keys are read from the environment only — never from the database, and never
entered through the admin panel. A key in a settings table is a key in every
backup and every screenshot of that screen.

Which provider handles which job is a runtime setting (Settings → AI) and
overrides the defaults above, so switching providers does not need a deploy —
but the key for the provider being switched _to_ has to already be present, and
adding one does need a restart.

`AI_CHAT_MODEL_GROQ` must name a **chat** model. A provider's model list also
contains speech-to-text, text-to-speech and moderation models, and picking one
of those fails with "does not support chat completions" — which reads like a
different fault than it is. `npm run ai:check` lists the chat models a key can
use and sends a real test message to the configured one:

```bash
npm run ai:check          # the default provider
npm run ai:check openai   # a specific one
```

Groq serves no embedding models. With `AI_DEFAULT_EMBED_PROVIDER=none` the
knowledge index stays empty and retrieval falls back to the Postgres search;
that is a supported configuration, not a broken one.

`AI_MONTHLY_BUDGET_USD` and the hard stop in Settings → AI cap the spend. The
cap is checked before each call, so it can be overshot by one request — pricing
a call before it runs is not possible, and refusing work on a guess is worse.

---

## First deploy

```bash
npm ci
npm run db:deploy          # migrate deploy — never `migrate dev` on a live database
npm run build
npm run worker:build
npm run create-admin       # once, to create the first Super Admin
```

`npm run db:deploy` applies committed migrations and creates no shadow database,
which is what makes it safe against a production role that cannot `CREATEDB`.

Then start both processes:

```bash
node .next/standalone/server.js        # web  (PORT, default 3000)
node dist-worker/worker.js             # worker
```

`output: 'standalone'` means `.next/standalone` carries its own `node_modules`.
Copy `.next/static` and `public/` next to it, or the site serves HTML with no
CSS — the most common first-deploy symptom.

---

## Later deploys

```bash
npm ci
npm run db:deploy
npm run build && npm run worker:build
# restart web, then worker
```

Migrations run before the new code starts. Every migration in this project is
written to be safe against the previous version still serving traffic for a few
seconds — additive columns, no destructive renames in the same release.

---

## Health and readiness

`GET /api/health` reports the database and Redis. Point the load balancer at it
and give the process a few seconds of grace: it answers before the first request
warms the connection pool.

The public pages are cached for five minutes (`revalidate = 300`) and
invalidated by tag when content is published, so an edit appears immediately
without the catalogue being re-queried on every visit.

---

## Content-Security-Policy

The policy is built per request in `src/server/security/headers.ts` and uses a
nonce with `strict-dynamic`. Two things follow from that:

- Adding a third-party script means adding its origin there, not inlining it.
  With `strict-dynamic` a host allowance alone does nothing — only a nonce or a
  hash executes a script.
- The public theme bootstrap is admitted by **hash**. If `THEME_INIT_SCRIPT` in
  `src/lib/site-theme.ts` is ever edited, run `npm run theme:hash` and redeploy;
  otherwise the browser refuses to run it and the site is stuck in light mode
  with nothing in the interface to explain why. The unit test catches it first.

---

## Backups

Three things, and all three are needed to restore:

1. **PostgreSQL** — `pg_dump` on a schedule, kept off the same host.
2. **The media directory** — the database stores keys, not files. A database
   restored without it renders a site full of broken images.
3. **`ENCRYPTION_KEY`** — without the exact key, encrypted settings in a restored
   database cannot be read.

Restore is the reverse, in that order, followed by `npm run db:deploy` in case
the backup predates the current schema.

---

## Before opening the site to the public

- `robotsAllowIndexing` is **off** by default. Turn it on in Settings → SEO when
  the content is real; a staging site that indexes itself is hard to undo.
- Clear the demo banner in Settings once seeded sample content is replaced.
- Confirm `ADMIN_PATH_FALLBACK=false` and that `https://<public-host>/admin`
  returns 404.
- Check that an enquiry sent from the contact form arrives — that path crosses
  the form, the database, the worker and the mail provider, so it is the single
  test that proves the deployment is whole.
