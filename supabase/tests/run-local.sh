#!/usr/bin/env bash
# Runs the Parle-to-Speak Supabase migration end-to-end against a scratch,
# throwaway Postgres 16 cluster, then runs supabase/tests/rls.sql against it.
#
# Must work when invoked as root (this environment's shell), where
# initdb/pg_ctl refuse to run directly: in that case every initdb/pg_ctl/psql
# call is prefixed with `runuser -u postgres --`, operating on a mktemp -d
# directory chowned to the `postgres` OS user, with the Unix socket under
# that same directory and listening on a free local TCP port.
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
if [[ ! -x "$PGBIN/initdb" ]]; then
  echo "SKIP: $PGBIN/initdb not found; skipping supabase/tests/run-local.sh"
  exit 0
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_MIGRATION="$HERE/../migrations/20261121000000_init.sql"
SQL_AUTH_STUB="$HERE/00_auth_stub.sql"
SQL_RLS="$HERE/rls.sql"

D="$(mktemp -d /tmp/pts-pg-test.XXXXXX)"
DATADIR="$D/data"
LOGFILE="$D/postgres.log"
PORT="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')"

AS_ROOT=0
if [[ "$(id -u)" -eq 0 ]]; then
  AS_ROOT=1
fi

run_as_pg() {
  if [[ "$AS_ROOT" -eq 1 ]]; then
    runuser -u postgres -- "$@"
  else
    "$@"
  fi
}

STARTED=0
cleanup() {
  if [[ "$STARTED" -eq 1 ]]; then
    run_as_pg "$PGBIN/pg_ctl" -D "$DATADIR" -m fast stop >/dev/null 2>&1 || true
  fi
  rm -rf "$D"
}
trap cleanup EXIT

echo "== Parle-to-Speak local Supabase migration test =="
echo "scratch dir: $D"
echo "port: $PORT"
echo "running as root: $AS_ROOT (postgres OS user used for initdb/pg_ctl/psql if so)"

if [[ "$AS_ROOT" -eq 1 ]]; then
  chown postgres:postgres "$D"
fi

echo "-- initdb --"
run_as_pg "$PGBIN/initdb" -D "$DATADIR" -U postgres --auth=trust >/dev/null

echo "-- pg_ctl start --"
run_as_pg "$PGBIN/pg_ctl" -D "$DATADIR" -l "$LOGFILE" \
  -o "-p $PORT -k $D -c listen_addresses=''" \
  -w start
STARTED=1

PSQL() {
  run_as_pg "$PGBIN/psql" -v ON_ERROR_STOP=1 -h "$D" -p "$PORT" -U postgres "$@"
}

echo "-- createdb --"
run_as_pg "$PGBIN/createdb" -h "$D" -p "$PORT" -U postgres pts_test

echo "-- apply 00_auth_stub.sql --"
PSQL -d pts_test -f "$SQL_AUTH_STUB"

echo "-- apply migration --"
PSQL -d pts_test -f "$SQL_MIGRATION"

echo "-- run rls.sql --"
PSQL -d pts_test -f "$SQL_RLS" 2>&1 | tee "$D/rls-output.log"

echo
echo "== Assertion summary =="
PASS_COUNT=$(grep -c 'NOTICE:  PASS:' "$D/rls-output.log" || true)
FAIL_COUNT=$(grep -c 'FAIL' "$D/rls-output.log" || true)
grep 'NOTICE:  PASS:' "$D/rls-output.log" || true

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  echo "FAILED: $FAIL_COUNT failure marker(s) found in output"
  exit 1
fi

echo "PASSED: $PASS_COUNT assertions, 0 failures"
echo "== run-local.sh: OK =="
