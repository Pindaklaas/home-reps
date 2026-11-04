#!/usr/bin/env bash
# Applies the Supabase migration and seed to a throwaway Postgres and checks the security rules.
# Needs Postgres 15+ binaries (initdb, pg_ctl, psql). Usage: scripts/test-supabase.sh
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1); BIN=${PG_BIN:-$BIN}
# Postgres refuses to run as root: use the postgres user then.
AS=(); [ "$(id -u)" = 0 ] && AS=(runuser -u postgres --)
DIR=$(mktemp -d); chmod 777 "$DIR"
trap '"${AS[@]}" "$BIN/pg_ctl" -D "$DIR/db" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
"${AS[@]}" "$BIN/initdb" -D "$DIR/db" -U postgres -A trust >/dev/null
"${AS[@]}" "$BIN/pg_ctl" -D "$DIR/db" -o "-k $DIR -c listen_addresses=''" -l "$DIR/log" start -w >/dev/null
PSQL=("$BIN/psql" -h "$DIR" -U postgres -d postgres -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f supabase/tests/stub-auth.sql
"${PSQL[@]}" -f supabase/migrations/20261104000000_init.sql
"${PSQL[@]}" -f supabase/seed.sql
"${PSQL[@]}" -t -f supabase/tests/rules.sql
