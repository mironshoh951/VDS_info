#!/usr/bin/env bash
#
# Diagnoses why the application cannot start.
#
#   bash scripts/doctor.sh
#
# Checks each dependency the app needs and, where something is wrong, says
# exactly what to do about it rather than just reporting a failure.

cd "$(dirname "$0")/.."

bold() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
hint() { printf '    \033[2m→ %s\033[0m\n' "$1"; }

PROBLEMS=0
problem() { PROBLEMS=$((PROBLEMS + 1)); }

# ---------------------------------------------------------------------------
bold "Toolchain"

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$NODE_MAJOR" -ge 22 ]; then ok "Node $(node -v)"
  else bad "Node $(node -v) — version 22 or newer is required"; problem; fi
else
  bad "Node.js is not installed"; hint "https://nodejs.org — install the LTS build"; problem
fi

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then ok "Docker is running"
  else
    bad "Docker is installed but not running"
    hint "Open Docker Desktop and wait until the whale icon stops animating"
    problem
  fi
else
  bad "Docker is not installed"
  hint "https://www.docker.com/products/docker-desktop — install, then reopen this terminal"
  problem
fi

# ---------------------------------------------------------------------------
bold "Configuration"

if [ -f .env ]; then
  ok ".env exists"
  # shellcheck disable=SC1091
  set -a; . ./.env 2>/dev/null; set +a

  if printf '%s' "${SESSION_SECRET:-}" | grep -q 'CHANGE_ME'; then
    bad "SESSION_SECRET still holds the placeholder value"
    hint "openssl rand -base64 48   — paste the result into .env"
    problem
  else ok "SESSION_SECRET is set"; fi

  if printf '%s' "${ENCRYPTION_KEY:-}" | grep -q 'CHANGE_ME'; then
    bad "ENCRYPTION_KEY still holds the placeholder value"
    hint "openssl rand -base64 32   — paste the result into .env"
    problem
  else ok "ENCRYPTION_KEY is set"; fi
else
  bad ".env is missing"; hint "cp .env.example .env   (or run: bash scripts/setup.sh)"; problem
fi

# ---------------------------------------------------------------------------
bold "Containers"

if docker info >/dev/null 2>&1; then
  RUNNING="$(docker compose ps --services --filter status=running 2>/dev/null || true)"
  for service in postgres redis; do
    if printf '%s\n' "$RUNNING" | grep -qx "$service"; then
      ok "$service container is running"
    else
      bad "$service container is not running"
      hint "docker compose up -d postgres redis"
      problem
    fi
  done

  # MinIO only backs media uploads, and that UI is not built yet — its absence
  # is worth reporting but must not be counted as a problem that blocks setup.
  if printf '%s\n' "$RUNNING" | grep -qx minio; then
    ok "minio container is running"
  else
    warn "minio container is not running (optional — media uploads only)"
    hint "docker logout && docker compose up -d minio minio-init"
  fi
else
  warn "Skipped — Docker is not available"
fi

# ---------------------------------------------------------------------------
bold "PostgreSQL"

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 &&
   docker compose ps --services --filter status=running 2>/dev/null | grep -qx postgres; then

  if docker compose exec -T postgres pg_isready -U vds -d vds >/dev/null 2>&1; then
    ok "Our container accepts connections as user 'vds'"
  else
    bad "The postgres container is up but not accepting connections yet"
    hint "Wait a few seconds and run this script again"
    problem
  fi

  # The container is healthy, so if the host port is answering with a different
  # server, something else owns 5432 and the app will talk to the wrong one.
  if command -v psql >/dev/null 2>&1; then
    if ! PGPASSWORD=vds_dev_password psql -h 127.0.0.1 -p 5432 -U vds -d vds -c 'SELECT 1' >/dev/null 2>&1; then
      bad "Port 5432 on this Mac is NOT our container"
      hint "Another PostgreSQL (Homebrew or Postgres.app) already owns port 5432."
      hint "Either stop it:        brew services stop postgresql@16"
      hint "Or move ours:          change the postgres port mapping in docker-compose.yml"
      hint "                       to \"5433:5432\" and set the port in DATABASE_URL to 5433"
      problem
    else
      ok "Port 5432 resolves to our database"
    fi
  fi
else
  # No container — check whether anything at all is listening, because
  # "role vds does not exist" means some other server answered.
  if command -v nc >/dev/null 2>&1 && nc -z 127.0.0.1 5432 >/dev/null 2>&1; then
    bad "Something is listening on 5432, but it is not our container"
    hint "That other PostgreSQL has no 'vds' role, which is why you see:"
    hint "  role \"vds\" does not exist"
    hint "Start ours (and stop theirs, or change our port) — see README"
    problem
  else
    bad "Nothing is listening on port 5432"
    hint "docker compose up -d postgres"
    problem
  fi
fi

# ---------------------------------------------------------------------------
bold "Redis"

if command -v nc >/dev/null 2>&1 && nc -z 127.0.0.1 6379 >/dev/null 2>&1; then
  ok "Redis is reachable on 6379"
else
  warn "Nothing is listening on port 6379 (optional in development —"
  warn "  the app falls back to an in-process cache and limiter)"
  hint "brew services start redis"
fi

# ---------------------------------------------------------------------------
bold "Database schema"

if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  ok "Migrations exist"
else
  warn "No migrations yet"
  hint "npx prisma migrate dev --name init"
fi

if [ -d src/server/db/generated ]; then
  ok "Prisma client is generated"
else
  bad "Prisma client has not been generated"
  hint "npx prisma generate"
  problem
fi

# ---------------------------------------------------------------------------
echo
if [ "$PROBLEMS" -eq 0 ]; then
  printf '\033[32m\033[1mEverything checks out. Run: npm run dev\033[0m\n\n'
else
  printf '\033[31m\033[1m%s problem(s) found — fix the ✗ lines above, then run this again.\033[0m\n\n' "$PROBLEMS"
fi
