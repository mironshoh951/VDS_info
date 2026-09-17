#!/usr/bin/env bash
#
# Switches the project from the Docker containers to a PostgreSQL running
# locally — typically Postgres.app.
#
#   bash scripts/use-local-postgres.sh
#
# Creates the `vds` role and database, installs the five extensions the schema
# needs, and points DATABASE_URL at it. Safe to re-run.
#
set -euo pipefail

cd "$(dirname "$0")/.."

bold() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }

DB_NAME="${DB_NAME:-vds}"
DB_USER="${DB_USER:-vds}"
DB_PASSWORD="${DB_PASSWORD:-vds_dev_password}"
PG_PORT="${PG_PORT:-5432}"

# ---------------------------------------------------------------------------
bold "1/6  Finding psql"

PSQL=""
for candidate in \
  /Applications/Postgres.app/Contents/Versions/latest/bin/psql \
  /Applications/Postgres.app/Contents/Versions/*/bin/psql \
  "$(command -v psql 2>/dev/null || true)"
do
  [ -x "$candidate" ] && { PSQL="$candidate"; break; }
done

[ -n "$PSQL" ] || fail "psql not found. Open Postgres.app once, then re-run."
ok "$($PSQL --version)"

# Postgres.app's superuser is the macOS account name.
SUPERUSER="${PGUSER:-$USER}"

$PSQL -h 127.0.0.1 -p "$PG_PORT" -U "$SUPERUSER" -d postgres -c 'SELECT 1' >/dev/null 2>&1 \
  || fail "Cannot connect on port $PG_PORT as '$SUPERUSER'. Is the server started in Postgres.app?"
ok "Connected as '$SUPERUSER' on port $PG_PORT"

su_psql() { $PSQL -h 127.0.0.1 -p "$PG_PORT" -U "$SUPERUSER" -v ON_ERROR_STOP=1 "$@"; }

# ---------------------------------------------------------------------------
bold "2/6  Checking required extensions"

MISSING=""
for ext in vector pg_trgm unaccent citext btree_gin; do
  if su_psql -d postgres -tAc \
      "SELECT 1 FROM pg_available_extensions WHERE name = '$ext'" | grep -q 1; then
    ok "$ext is available"
  else
    warn "$ext is NOT available"
    MISSING="$MISSING $ext"
  fi
done

if [ -n "$MISSING" ]; then
  echo
  fail "This PostgreSQL is missing:$MISSING
     'vector' (pgvector) is the one that matters — the schema stores AI
     embeddings in a vector(1536) column and will not migrate without it.
     Postgres.app 2.7 and newer bundle pgvector; older builds do not.
     Update Postgres.app, or install pgvector for this server, then re-run."
fi

# ---------------------------------------------------------------------------
bold "3/6  Role and database"

# The role is given the same standing it had inside the Docker container this
# replaces, because the tooling depends on all three:
#   LOGIN      — connect at all
#   CREATEDB   — `prisma migrate dev` builds a temporary shadow database
#   SUPERUSER  — `CREATE EXTENSION vector` is not a trusted extension, so a
#                plain role cannot install it during the migration
# This is a local development database on your own machine. A deployed server
# gets a restricted role and has its extensions installed once, by an admin.
ROLE_ATTRS="LOGIN CREATEDB SUPERUSER PASSWORD '$DB_PASSWORD'"

if su_psql -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" | grep -q 1; then
  su_psql -d postgres -c "ALTER ROLE $DB_USER WITH $ROLE_ATTRS;" >/dev/null
  ok "Role '$DB_USER' updated (login, createdb, superuser)"
else
  su_psql -d postgres -c "CREATE ROLE $DB_USER WITH $ROLE_ATTRS;" >/dev/null
  ok "Role '$DB_USER' created (login, createdb, superuser)"
fi

if su_psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1; then
  ok "Database '$DB_NAME' already exists"
else
  su_psql -d postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" >/dev/null
  ok "Database '$DB_NAME' created"
fi

# ---------------------------------------------------------------------------
bold "4/6  Installing extensions into '$DB_NAME'"

for ext in vector pg_trgm unaccent citext btree_gin; do
  su_psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS $ext;" >/dev/null
done
su_psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" >/dev/null
ok "Extensions installed"

# A database that already existed may be owned by the macOS account rather than
# by `vds`, which would stop the migration tooling from replacing the schema.
su_psql -d postgres -c "ALTER DATABASE $DB_NAME OWNER TO $DB_USER;" >/dev/null
su_psql -d "$DB_NAME" -c "ALTER SCHEMA public OWNER TO $DB_USER;" >/dev/null
ok "Ownership assigned to '$DB_USER'"

# ---------------------------------------------------------------------------
bold "5/6  Shadow database"

# `prisma migrate dev` verifies migrations against a throwaway "shadow"
# database. Left to itself Prisma creates one, and PostgreSQL copies it from
# template1 — so anything that was ever created in template1 appears inside
# what is supposed to be an empty database, and the first CREATE TABLE fails
# with "relation already exists". Handing Prisma a database built from
# template0 removes that dependency entirely.
SHADOW_DB="${DB_NAME}_shadow"

if su_psql -d template1 -tAc \
    "SELECT 1 FROM pg_tables WHERE schemaname = 'public' LIMIT 1" \
    2>/dev/null | grep -q 1; then
  warn "template1 on this server contains tables — that is what broke the"
  warn "  shadow database. Using a dedicated one instead."
fi

su_psql -d postgres -c "DROP DATABASE IF EXISTS $SHADOW_DB;" >/dev/null 2>&1 || true
su_psql -d postgres -c "CREATE DATABASE $SHADOW_DB TEMPLATE template0 OWNER $DB_USER;" >/dev/null
ok "Clean shadow database '$SHADOW_DB' created from template0"

# ---------------------------------------------------------------------------
bold "6/6  Pointing .env at this server"

NEW_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:$PG_PORT/$DB_NAME?schema=public"
SHADOW_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:$PG_PORT/$SHADOW_DB?schema=public"
python3 - "$NEW_URL" "$SHADOW_URL" <<'PYEOF'
import io, re, sys
url, shadow = sys.argv[1], sys.argv[2]
env = io.open('.env', encoding='utf-8').read()
env = re.sub(r'^DATABASE_URL=.*$', 'DATABASE_URL=' + url, env, flags=re.M)
if re.search(r'^SHADOW_DATABASE_URL=', env, flags=re.M):
    env = re.sub(r'^SHADOW_DATABASE_URL=.*$', 'SHADOW_DATABASE_URL=' + shadow, env, flags=re.M)
else:
    env = re.sub(r'^(DATABASE_URL=.*)$', r'\1\nSHADOW_DATABASE_URL=' + shadow, env, flags=re.M)
io.open('.env', 'w', encoding='utf-8').write(env)
PYEOF
ok "DATABASE_URL and SHADOW_DATABASE_URL updated"

cat <<EOF

Done. This project no longer needs Docker for the database.

  Apply the schema:   npx prisma migrate dev --name init
  Seed content:       npm run db:seed
  Create the admin:   npm run create-admin -- --email admin@admin.com --name Administrator --password admin --role SUPER_ADMIN
  Start the site:     npm run dev

Redis is not running either. In development the app falls back to an
in-process cache and limiter, so this is fine. For the real thing later:
brew install redis && brew services start redis

EOF
