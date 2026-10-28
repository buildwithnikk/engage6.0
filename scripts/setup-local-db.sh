#!/usr/bin/env bash
# Create the local development database and application role, and write
# DATABASE_URL into backend/.env (which is git-ignored).
#
# Local PostgreSQL is the development database. Supabase is the deployment
# target — see docs/database-schema.md.
#
# Safe to re-run: it creates what is missing and rotates the dev password.
# It never prints the password and never touches another project's database.
#
# Usage:  ./scripts/setup-local-db.sh

set -euo pipefail

DB_NAME="${DB_NAME:-sahayak_dev}"
DB_ROLE="${DB_ROLE:-sahayak_app}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/backend/.env"

command -v psql >/dev/null || {
  echo "psql not found. Install PostgreSQL first:" >&2
  echo "  brew install postgresql@16 && brew services start postgresql@16" >&2
  exit 1
}

pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1 || {
  echo "PostgreSQL is not accepting connections on $DB_HOST:$DB_PORT." >&2
  echo "  brew services start postgresql@16" >&2
  exit 1
}

PW="$(python3 -c 'import secrets; print(secrets.token_urlsafe(18))')"

# The application role is deliberately NOT a superuser and does NOT have
# BYPASSRLS. A privileged connection would silently skip every Row Level
# Security policy, so local development must not use one either.
psql -d postgres -v ON_ERROR_STOP=1 -q <<SQL
do \$\$
begin
  if not exists (select 1 from pg_roles where rolname = '$DB_ROLE') then
    create role $DB_ROLE with login password '$PW';
  else
    alter role $DB_ROLE with login password '$PW';
  end if;
end
\$\$;
SQL

if ! psql -d postgres -tAc "select 1 from pg_database where datname='$DB_NAME'" | grep -q 1; then
  createdb -O "$DB_ROLE" "$DB_NAME"
  echo "created database $DB_NAME"
else
  echo "database $DB_NAME already exists"
fi

psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -q -c "grant all on schema public to $DB_ROLE;"

[ -f "$ENV_FILE" ] || cp "$REPO_ROOT/backend/.env.example" "$ENV_FILE"

DB_ROLE="$DB_ROLE" DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" DB_NAME="$DB_NAME" \
ENV_FILE="$ENV_FILE" PW="$PW" python3 <<'PY'
import os, pathlib, urllib.parse

pw = urllib.parse.quote(os.environ["PW"], safe="")
url = (
    f"postgresql+psycopg://{os.environ['DB_ROLE']}:{pw}"
    f"@{os.environ['DB_HOST']}:{os.environ['DB_PORT']}/{os.environ['DB_NAME']}"
)

path = pathlib.Path(os.environ["ENV_FILE"])
lines = path.read_text().splitlines() if path.exists() else []

replaced = False
out = []
for line in lines:
    if line.startswith("DATABASE_URL="):
        out.append(f"DATABASE_URL={url}")
        replaced = True
    else:
        out.append(line)
if not replaced:
    out.append(f"DATABASE_URL={url}")

path.write_text("\n".join(out) + "\n")
PY

echo "wrote DATABASE_URL to backend/.env (git-ignored; password not printed)"
echo
echo "Next:"
echo "  cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000"
echo "  curl -s http://localhost:8000/api/v1/health"
echo "Expect: {\"status\":\"ok\",\"version\":\"0.1.0\",\"database\":\"ok\",\"detail\":null}"
