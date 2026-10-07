#!/usr/bin/env bash
# Draait migraties + RLS-tests tegen een lege PostgreSQL (DATABASE_URL), met een auth-shim.
set -euo pipefail
: "${DATABASE_URL:?zet DATABASE_URL naar een lege testdatabase}"
cd "$(dirname "$0")/.."
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/auth_shim.sql
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f "$f"; done
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
