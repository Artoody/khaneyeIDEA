#!/usr/bin/env bash
# Starts local Postgres and Redis without Docker (used in cloud dev sessions).
# On a normal machine prefer: docker compose up -d
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN=/usr/lib/postgresql/16/bin
DATA="$ROOT/.devdata/pg"
mkdir -p "$ROOT/.devdata"
chown -R postgres:postgres "$ROOT/.devdata"
if [ ! -f "$DATA/PG_VERSION" ]; then
  su postgres -c "$PGBIN/initdb -D $DATA -U postgres --auth=trust -E UTF8 --locale=C.UTF-8" >/dev/null
fi
if ! su postgres -c "$PGBIN/pg_ctl -D $DATA status" >/dev/null 2>&1; then
  rm -f "$DATA/postmaster.pid"
  su postgres -c "$PGBIN/pg_ctl -D $DATA -l $ROOT/.devdata/pg.log -o '-p 5432 -k /tmp' -w start" >/dev/null
fi
psql -h 127.0.0.1 -U postgres -tc "select 1 from pg_database where datname='khaneyeidea'" | grep -q 1 || psql -h 127.0.0.1 -U postgres -c "create database khaneyeidea" >/dev/null
redis-cli ping >/dev/null 2>&1 || redis-server --daemonize yes --port 6379 >/dev/null
echo "postgres and redis are up"
