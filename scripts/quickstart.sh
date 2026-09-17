#!/usr/bin/env bash
#
# One-command local bring-up for the VDS Dental Platform.
#
#   bash scripts/quickstart.sh
#
# Starts the containers, applies the schema, loads seed content and creates a
# development administrator (admin@admin.com / admin). Safe to re-run.
#
set -euo pipefail

cd "$(dirname "$0")/.."

bold() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }

ADMIN_EMAIL="admin@admin.com"
ADMIN_PASSWORD="admin"
ADMIN_NAME="Administrator"

# ---------------------------------------------------------------------------
bold "1/5  Services"

# The database may be a Docker container or a PostgreSQL installed on the host
# (Postgres.app). The host database is checked FIRST: when `docker` is left on
# PATH by an uninstalled Docker Desktop, `docker info` blocks on a socket that
# will never answer, so it must never be reached when it is not needed.
db_reachable() {
  node -e '
    const net = require("net")
    const u = new URL(process.env.DATABASE_URL)
    const s = net.connect({ host: u.hostname, port: u.port || 5432, timeout: 2000 })
    s.on("connect", () => { s.destroy(); process.exit(0) })
    s.on("error", () => process.exit(1))
    s.on("timeout", () => { s.destroy(); process.exit(1) })
  ' 2>/dev/null
}

# `docker info` with no daemon can hang indefinitely, so it is given a hard
# ceiling rather than being trusted to return.
docker_ready() {
  command -v docker >/dev/null 2>&1 || return 1
  ( docker info >/dev/null 2>&1 ) &
  local pid=$! waited=0
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$waited" -ge 8 ]; then
      kill -9 "$pid" 2>/dev/null || true
      return 1
    fi
    sleep 1
    waited=$((waited + 1))
  done
  wait "$pid"
}

set -a; [ -f .env ] && . ./.env; set +a

if db_reachable; then
  USE_DOCKER=0
  ok "Database already reachable — nothing to start"
elif docker_ready; then
  USE_DOCKER=1
else
  fail "No database is reachable and Docker is not running.
     Start the server in Postgres.app, then run:  npm run use-local-postgres"
fi

if [ "$USE_DOCKER" = "1" ]; then

# Postgres and Redis are required. MinIO is only needed for media uploads —
# that UI is not built yet, so a failed image pull must not stop the setup.
docker compose up -d postgres redis
ok "PostgreSQL and Redis started"

if docker compose up -d minio minio-init >/dev/null 2>&1; then
  ok "MinIO started"
else
  warn "MinIO could not start (image pull failed) — skipping."
  warn "Nothing in the app needs it yet. To fix it later: docker logout, then"
  warn "  docker compose up -d minio minio-init"
fi

  printf '  waiting for PostgreSQL'
  for _ in $(seq 1 60); do
    if docker compose exec -T postgres pg_isready -U vds -d vds >/dev/null 2>&1; then
      printf '\n'; ok "PostgreSQL is ready"; break
    fi
    printf '.'; sleep 1
  done

  docker compose exec -T postgres pg_isready -U vds -d vds >/dev/null 2>&1 \
    || fail "PostgreSQL never became ready. Another Postgres may own port 5432 — run: npm run doctor"
fi

# ---------------------------------------------------------------------------
bold "2/5  Prisma client"
npx prisma generate >/dev/null
ok "Client generated"

# ---------------------------------------------------------------------------
bold "3/5  Database schema"

# Locate a psql, including the one inside Postgres.app's bundle.
PSQL_BIN=""
for candidate in \
  /Applications/Postgres.app/Contents/Versions/latest/bin/psql \
  /Applications/Postgres.app/Contents/Versions/*/bin/psql \
  "$(command -v psql 2>/dev/null || true)"
do
  [ -x "$candidate" ] && { PSQL_BIN="$candidate"; break; }
done

# DATABASE_URL carries Prisma's own `?schema=` parameter, which libpq rejects
# as an unknown URI parameter. psql gets the same connection without it.
PG_URI="$(node -e 'const u = new URL(process.env.DATABASE_URL); u.search = ""; process.stdout.write(u.toString())' 2>/dev/null || true)"

# Three states matter, and only the third is safe to migrate straight into:
#   * no migration files      -> generate the first migration
#   * files, but the database has never been migrated -> it may carry objects
#     from an earlier attempt, which Prisma reports as drift and refuses to
#     work around, so the schema is cleared first
#   * files and a matching history -> just apply what is pending
HAS_FILES=0
[ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ] && HAS_FILES=1

HAS_HISTORY=0
if [ "$USE_DOCKER" = "1" ]; then
  docker compose exec -T postgres psql -U vds -d vds -tAc \
    "SELECT to_regclass('public._prisma_migrations') IS NOT NULL" 2>/dev/null \
    | grep -q t && HAS_HISTORY=1
elif [ -n "$PSQL_BIN" ]; then
  "$PSQL_BIN" "$PG_URI" -tAc \
    "SELECT to_regclass('public._prisma_migrations') IS NOT NULL" 2>/dev/null \
    | grep -q t && HAS_HISTORY=1
fi

if [ "$HAS_HISTORY" = "0" ]; then
  warn "This database has no migration history — clearing its schema"
  if [ "$USE_DOCKER" = "1" ]; then
    docker compose exec -T postgres psql -U vds -d vds -v ON_ERROR_STOP=1 \
      -c 'DROP SCHEMA IF EXISTS public CASCADE;' \
      -c 'CREATE SCHEMA public;' \
      -c 'GRANT ALL ON SCHEMA public TO vds;' >/dev/null \
      || fail "Could not clear the schema. Stop 'npm run dev' and try again."
  else
    [ -n "$PSQL_BIN" ] || fail "psql not found — cannot clear the schema."
    "$PSQL_BIN" "$PG_URI" -v ON_ERROR_STOP=1 \
      -c 'DROP SCHEMA IF EXISTS public CASCADE;' \
      -c 'CREATE SCHEMA public;' >/dev/null \
      || fail "Could not clear the schema. Stop 'npm run dev' and try again."
  fi
  ok "Schema cleared"
fi

if [ "$HAS_FILES" = "1" ]; then
  # `migrate deploy` applies the existing migrations and — unlike `migrate
  # dev` — never builds a shadow database, so bringing the site up cannot be
  # blocked by whatever the local PostgreSQL copies into a new database.
  # Generating a migration for a schema edit stays an explicit, separate step:
  #   npx prisma migrate dev --name <what-changed>
  npx prisma migrate deploy
else
  npx prisma migrate dev --name init
fi
ok "Schema applied"

# ---------------------------------------------------------------------------
bold "4/5  Seed content"
npm run db:seed
ok "Seed data loaded"

# ---------------------------------------------------------------------------
bold "5/5  Administrator account"

npm run create-admin -- \
  --email "$ADMIN_EMAIL" \
  --name "$ADMIN_NAME" \
  --password "$ADMIN_PASSWORD" \
  --role SUPER_ADMIN <<< 'y'   # 'y' answers the reset prompt when re-run

# ---------------------------------------------------------------------------
bold "Ready."
cat <<EOF

  Start the site:   npm run dev

  Public site:      http://localhost:3000
  Admin panel:      http://localhost:3000/admin

  Email:            $ADMIN_EMAIL
  Password:         $ADMIN_PASSWORD

  This password is accepted because NODE_ENV=development. Change it in
  Settings before this ever goes near a real server.

EOF
