#!/usr/bin/env bash
# Local database tasks for Sahayak.
#
#   ./scripts/db.sh migrate     apply every migration in supabase/migrations (idempotent)
#   ./scripts/db.sh rollback    apply the newest .down.sql (destructive)
#   ./scripts/db.sh seed        insert/update synthetic demo schemes (idempotent)
#   ./scripts/db.sh reset       rollback + migrate + seed
#   ./scripts/db.sh test-db     create/refresh the isolated test database
#   ./scripts/db.sh psql        open a shell on the development database
#
# Reads DATABASE_URL from backend/.env. Never prints the connection string.
# The same .sql files apply to hosted PostgreSQL later — see docs/database-schema.md.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
ENV_FILE="$REPO_ROOT/backend/.env"

die() { echo "error: $*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || die "backend/.env not found. Run ./scripts/setup-local-db.sh first."

# Read DATABASE_URL without sourcing the file (values may contain shell metacharacters).
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
[ -n "${DATABASE_URL:-}" ] || die "DATABASE_URL is empty in backend/.env"

# psql does not understand SQLAlchemy's '+psycopg' dialect suffix.
PSQL_URL="${DATABASE_URL/postgresql+psycopg:/postgresql:}"

command -v psql >/dev/null || die "psql not found. See README 'Local development'."

run_sql_file() {
    psql "$PSQL_URL" -v ON_ERROR_STOP=1 -q -f "$1"
}

case "${1:-}" in
  migrate)
    shopt -s nullglob
    files=("$MIGRATIONS_DIR"/*.sql)
    applied=0
    for f in "${files[@]}"; do
        case "$f" in *.down.sql) continue ;; esac
        echo "applying $(basename "$f")"
        run_sql_file "$f"
        applied=$((applied + 1))
    done
    [ "$applied" -gt 0 ] || echo "no migrations found"
    echo "migrate: done"
    ;;

  rollback)
    shopt -s nullglob
    downs=("$MIGRATIONS_DIR"/*.down.sql)
    [ ${#downs[@]} -gt 0 ] || die "no .down.sql files found"
    newest="${downs[-1]}"
    echo "rolling back $(basename "$newest") — this DROPS the catalogue."
    read -r -p "type 'yes' to continue: " confirm
    [ "$confirm" = "yes" ] || die "aborted"
    run_sql_file "$newest"
    echo "rollback: done"
    ;;

  seed)
    cd "$REPO_ROOT/backend"
    [ -x .venv/bin/python ] || die "backend/.venv not found. See README."
    .venv/bin/python -m app.seed
    ;;

  reset)
    "$0" rollback && "$0" migrate && "$0" seed
    ;;

  test-db)
    # The test database is separate so a test run can never damage development data.
    TEST_DB="${TEST_DB:-sahayak_test}"
    OWNER="$(psql "$PSQL_URL" -tAc 'select current_user')"
    psql "${PSQL_URL%/*}/postgres" -tAc "select 1 from pg_database where datname='$TEST_DB'" | grep -q 1 \
      || createdb -O "$OWNER" "$TEST_DB"
    TEST_URL="${PSQL_URL%/*}/$TEST_DB"
    for f in "$MIGRATIONS_DIR"/*.sql; do
        case "$f" in *.down.sql) continue ;; esac
        psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$f"
    done
    echo "test database '$TEST_DB' is ready (schema applied, no seed data)"
    echo "export TEST_DATABASE_URL=postgresql+psycopg://<user>:<password>@<host>:5432/$TEST_DB"
    ;;

  psql)
    exec psql "$PSQL_URL"
    ;;

  *)
    sed -n '2,15p' "$0"
    exit 1
    ;;
esac
