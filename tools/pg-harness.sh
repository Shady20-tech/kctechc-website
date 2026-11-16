#!/usr/bin/env bash
# Apply the Supabase shim and every migration, in filename order, to a scratch
# Postgres 17 + PostGIS database, then optionally run the validate scripts.
#
# The container is expected to be running already (see AGENTS.md: a Postgres 17
# server is reachable on localhost:5432, `psql` may not be installed but
# `docker exec` works).
#
# Usage:
#   tools/pg-harness.sh migrate            # apply shim + migrations
#   tools/pg-harness.sh validate           # run supabase/validate/*.sql
#   tools/pg-harness.sh all                # both
set -uo pipefail

CONTAINER="${KC_PG_CONTAINER:-kc-pg}"
DB="${KC_PG_DB:-kc_harness}"
USER="${KC_PG_USER:-postgres}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

psql_file() {
  # Strip psql meta-commands (\set, \i) that a non-psql client cannot parse, and
  # feed the rest through docker exec.
  sed -E '/^\\set /d; /^\\i /d' "$1" | docker exec -i "$CONTAINER" \
    psql -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 -q -f - >/dev/null
}

migrate() {
  docker exec -i "$CONTAINER" psql -U "$USER" -d postgres -q \
    -c "drop database if exists $DB with (force)" \
    -c "create database $DB" >/dev/null || return 1

  # PostGIS and pgcrypto live in the extensions schema; the shim declares the
  # Supabase roles the migrations grant to.
  psql_file "$ROOT/supabase/validate/00_supabase_shim.sql" || {
    echo "shim FAILED"; return 1; }

  local count=0
  for f in "$ROOT"/supabase/migrations/*.sql; do
    if ! psql_file "$f"; then
      echo "MIGRATION FAILED: $(basename "$f")"
      return 1
    fi
    count=$((count + 1))
  done
  echo "applied $count migrations cleanly"
}

validate() {
  local failures=0
  for f in "$ROOT"/supabase/validate/*.sql; do
    case "$(basename "$f")" in
      00_*) continue ;;  # the shim is applied during migrate
    esac
    if psql_file "$f" 2>/tmp/validate-err.txt; then
      echo "validate OK: $(basename "$f")"
    else
      echo "validate FAILED: $(basename "$f")"
      cat /tmp/validate-err.txt
      failures=$((failures + 1))
    fi
  done
  return $failures
}

case "${1:-all}" in
  migrate) migrate ;;
  validate) validate ;;
  all) migrate && validate ;;
  *) echo "usage: $0 {migrate|validate|all}"; exit 2 ;;
esac
