#!/bin/sh
set -eu

echo "[api] Waiting for Postgres at postgres:5432…"
i=0
until node -e "
const net = require('net');
const s = net.connect(5432, 'postgres', () => { s.end(); process.exit(0); });
s.on('error', () => process.exit(1));
"; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "[api] Postgres not ready after 120s"
    exit 1
  fi
  sleep 2
done

echo "[api] Running migrations…"
cd /app/packages/database
./node_modules/.bin/prisma migrate deploy \
  || ../../node_modules/.bin/prisma migrate deploy \
  || npx prisma migrate deploy

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "[api] Seeding database…"
  ./node_modules/.bin/tsx prisma/seed.ts \
    || ../../node_modules/.bin/tsx prisma/seed.ts \
    || npx tsx prisma/seed.ts \
    || echo "[api] Seed warning — continuing"
fi

echo "[api] Starting NestJS on :${API_PORT:-4000}…"
cd /app
exec node apps/api/dist/main.js
