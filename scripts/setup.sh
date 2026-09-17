#!/usr/bin/env bash
#
# First-time setup for the VDS Dental Platform.
#
# Safe to re-run: it never overwrites an existing .env and every step reports
# what it did. Run it from the project root:
#
#   bash scripts/setup.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }

bold "VDS Dental Platform — setup"
echo "Project: $ROOT"
echo

# ---------------------------------------------------------------------------
bold "1/7  Checking required tools"

command -v node >/dev/null 2>&1 || fail "Node.js is not installed. Install Node 22+ from https://nodejs.org"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || fail "Node 22 or newer is required (found $(node -v))."
ok "Node $(node -v)"

command -v npm >/dev/null 2>&1 || fail "npm is not installed."
ok "npm $(npm -v)"

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  HAVE_DOCKER=1
  ok "Docker is running"
else
  HAVE_DOCKER=0
  warn "Docker is not available. You will need PostgreSQL 16 (with pgvector),"
  warn "Redis and an S3-compatible store running some other way."
fi

# ---------------------------------------------------------------------------
echo
bold "2/7  Environment file"

if [ -f .env ]; then
  ok ".env already exists — leaving it untouched"
else
  cp .env.example .env

  # Generate real secrets rather than leaving the CHANGE_ME placeholders,
  # which the environment validator rejects on boot.
  SESSION_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
  ENCRYPTION_KEY="$(openssl rand -base64 32 | tr -d '\n')"

  if [ "$(uname)" = "Darwin" ]; then SED_INPLACE=(-i ''); else SED_INPLACE=(-i); fi
  sed "${SED_INPLACE[@]}" "s|^SESSION_SECRET=.*|SESSION_SECRET=${SESSION_SECRET}|" .env
  sed "${SED_INPLACE[@]}" "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=${ENCRYPTION_KEY}|" .env

  ok ".env created with freshly generated secrets"
fi

# ---------------------------------------------------------------------------
echo
bold "3/7  Starting services (PostgreSQL, Redis, MinIO)"

if [ "$HAVE_DOCKER" = "1" ]; then
  docker compose up -d postgres redis minio minio-init
  ok "Containers started"

  printf '  waiting for PostgreSQL'
  for _ in $(seq 1 60); do
    if docker compose exec -T postgres pg_isready -U vds -d vds >/dev/null 2>&1; then
      printf '\n'; ok "PostgreSQL is ready"; break
    fi
    printf '.'; sleep 1
  done
else
  warn "Skipped — start your own PostgreSQL/Redis and update DATABASE_URL and"
  warn "REDIS_URL in .env before continuing."
fi

# ---------------------------------------------------------------------------
echo
bold "4/7  Installing dependencies"
npm install
ok "Dependencies installed"

# ---------------------------------------------------------------------------
echo
bold "5/7  Generating the Prisma client"
npx prisma generate
ok "Prisma client generated"

# ---------------------------------------------------------------------------
echo
bold "6/7  Applying the database migration"

if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  npx prisma migrate deploy
  ok "Migrations applied"
else
  npx prisma migrate dev --name init
  ok "Initial migration created and applied"
fi

# ---------------------------------------------------------------------------
echo
bold "7/7  Seeding reference data"

npm run db:seed
ok "Seed data loaded"

# ---------------------------------------------------------------------------
echo
bold "Done."
echo
echo "  Create your administrator account:   npm run create-admin"
echo "  Start the app:                       npm run dev"
echo
echo "  Public site:     http://localhost:3000"
echo "  Admin panel:     http://localhost:3000/admin"
echo
echo "  Something wrong? Run:  npm run doctor"
echo "  Inspect the database:  npm run db:studio"
echo
